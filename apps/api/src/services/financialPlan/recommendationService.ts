import { buildFinancialPlanExplanationContext } from "./helpers/explanationContext.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ForecastUnavailableError, ForecastUpstreamError, ForecastValidationError, getMlForecast, type ForecastPayload } from "../forecastService.js";
import { recommendPlanCategories, type MlExpenseForecastSnapshot, type MlPlanCategory } from "./mlAdapter.js";
import { isUserFacingFinancialPlanExplanation, zeroAllocationExplanations, type FinancialPlanEvidence } from "./explanationService.js";
import { deterministicFinancialPlanExplanations, type FinancialPlanExplanationRequest } from "./explanationRequest.js";
import { deriveSurplusRecommendation } from "./classificationPolicy.js";
import { createFinancialConditionAssessment } from "../financialConditionAssessmentService.js";
import { getServiceRoleClient } from "../../lib/supabase.js";
import { scheduledCategoryAmounts, subtractScheduledAmounts, subtractScheduledForecast, subtractScheduledRequirements } from "./helpers/scheduledCategoryAmounts.js";
import { scheduledPaymentReservations, type ScheduledPaymentRow } from "./scheduledPaymentDates.js";

const MANILA = "Asia/Manila";
const MAX_HISTORY = 500;
const ESSENTIAL_HFCE_CATEGORY_SLUGS = new Set(["food", "housing_water_utilities", "health", "communication", "transport", "education", "furnishings_household", "clothing_footwear"]);
const SEASONAL_LABELS: Record<string, string> = { q1: "January–March", q2: "April–June", q3: "July–September", q4: "October–December", rainy_season: "Rainy Season", back_to_school: "Back-to-School Season", undas: "Undas / All Souls' Day", christmas_ber_months: "Christmas and Ber Months", new_year: "New Year", summer: "Summer", annual_payments: "Tax and Annual-Payment Season", family_celebrations: "Birthday and Family-Celebration Months" };
const SEASONAL_WINDOWS: Record<string, string> = { q1: "January to March", q2: "April to June", q3: "July to September", q4: "October to December", rainy_season: "June to November", back_to_school: "June to August", undas: "October to November", christmas_ber_months: "September to December", new_year: "January", summer: "March to May", annual_payments: "January to April", family_celebrations: "varies by the selected month" };
const SEASONAL_MONTHS: Record<string, number[]> = { q1: [1, 2, 3], q2: [4, 5, 6], q3: [7, 8, 9], q4: [10, 11, 12], rainy_season: [6, 7, 8, 9, 10, 11], back_to_school: [6, 7, 8], undas: [10, 11], christmas_ber_months: [9, 10, 11, 12], new_year: [1], summer: [3, 4, 5], annual_payments: [1, 2, 3, 4], family_celebrations: [] };

type Subcategory = { id: string; category_id: string | null; label: string; minimum_amount_centavos: number | null; fixed_amount_centavos: number | null; always_in_budget: boolean };
type Category = { id: string; slug: string; label: string; minimum_amount_centavos: number | null; fixed_amount_centavos: number | null };
type Timestamped = { updated_at: string };
type Debt = Timestamped & { id: string; current_balance_centavos: number; minimum_payment_centavos: number; payment_frequency: string; payment_schedule: { semiMonthlyDays?: [number, number]; customIntervalDays?: number } | null; next_due_date: string | null; annual_interest_rate_bps: number; allows_extra_payments: boolean };
type Goal = Timestamped & { id: string; planned_contribution_amount_centavos: number | null; contribution_frequency: string | null; contribution_interval_count: number | null; contribution_day_of_month: number | null; contribution_second_day_of_month: number | null; custom_interval_days: number | null; next_contribution_date: string | null; goal_type: string; target_amount_centavos: number; current_amount_centavos: number };
type CardPayment = { statement_id: string | null; transaction_id: string | null; amount_centavos: number };
type Statement = { id: string; minimum_due_centavos: number; due_date: string };
type FinancialAccount = Timestamped & { kind: string; current_balance_centavos: number };
type Transaction = Timestamped & { id: string; amount_centavos: number; transaction_date: string; transaction_type: "income" | "expense"; category_id: string | null; subcategory_id: string | null; source_savings_goal_id?: string | null; destination_savings_goal_id?: string | null };
type OnboardingSession = { raw_answers: Record<string, unknown> | null };
type ManualAllocation = { target: "category" | "subcategory"; id: string; amountCentavos: number };
type ReservationSkips = { skipDebtRepayments?: boolean; skipSavingsContributions?: boolean };
type AnomalyEvaluation = { transaction_id: string; is_anomaly: boolean };
type TransactionWithAnomalies = Transaction & { anomaly_evaluations: AnomalyEvaluation[] | null };

function selectEligibleDebt(debts: Debt[], strategy: "avalanche" | "snowball", priorityIds: string[]): string | null {
  const eligible = debts.filter((debt) => debt.allows_extra_payments && debt.current_balance_centavos > 0);
  const priorityRank = new Map(priorityIds.map((id, index) => [id, index]));
  return eligible.sort((left, right) => {
    const leftPriority = priorityRank.get(left.id);
    const rightPriority = priorityRank.get(right.id);
    if (leftPriority !== undefined || rightPriority !== undefined) return (leftPriority ?? Number.MAX_SAFE_INTEGER) - (rightPriority ?? Number.MAX_SAFE_INTEGER);
    return strategy === "snowball"
      ? left.current_balance_centavos - right.current_balance_centavos || right.annual_interest_rate_bps - left.annual_interest_rate_bps || left.id.localeCompare(right.id)
      : right.annual_interest_rate_bps - left.annual_interest_rate_bps || left.current_balance_centavos - right.current_balance_centavos || left.id.localeCompare(right.id);
  })[0]?.id ?? null;
}

export class FinancialPlanInputError extends Error {}
export class FinancialPlanUnavailableError extends Error {}

export function isFinancialPlanInfeasible(availableCentavos: number, minimumRequiredCentavos: number): boolean {
  return availableCentavos <= 0 || minimumRequiredCentavos > availableCentavos;
}

export function financialPlanPriorityGroup(categorySlug: string | undefined): MlPlanCategory["priorityGroup"] {
  return categorySlug && ESSENTIAL_HFCE_CATEGORY_SLUGS.has(categorySlug) ? "ESSENTIAL" : "NON_ESSENTIAL";
}

export function applyFinancialPlanPriorityWeights(categories: MlPlanCategory[], cleanSpendByTarget: Map<string, number>): MlPlanCategory[] {
  const weights = new Map<string, number>();
  for (const priorityGroup of ["ESSENTIAL", "NON_ESSENTIAL"] as const) {
    const group = categories.filter((category) => category.priorityGroup === priorityGroup);
    const baselineTotal = group.reduce((sum, category) => sum + (cleanSpendByTarget.get(category.id) ?? 0), 0);
    const forecastTotal = group.reduce((sum, category) => sum + category.forecastCentavos, 0);
    for (const category of group) {
      weights.set(category.id, baselineTotal > 0
        ? (cleanSpendByTarget.get(category.id) ?? 0) / baselineTotal
        : forecastTotal > 0 ? category.forecastCentavos / forecastTotal : 1 / group.length);
    }
  }
  return categories.map((category) => ({ ...category, priorityWeight: weights.get(category.id) ?? 1 }));
}

export function excludeUnusualTransactions<T extends { id: string }>(transactions: T[], unusualTransactionIds: Set<string>): T[] {
  return transactions.filter((transaction) => !unusualTransactionIds.has(transaction.id));
}

function latestSourceUpdate(...groups: unknown[][]): string | null {
  const updates = groups.flatMap((group) => group.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const updatedAt = (item as { updated_at?: unknown }).updated_at;
    return typeof updatedAt === "string" && !Number.isNaN(new Date(updatedAt).getTime()) ? [updatedAt] : [];
  }));
  return updates.sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
}

export function currentCalendarMonth(now = new Date()): { start: string; end: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: MANILA, year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")!.value);
  const month = Number(parts.find((part) => part.type === "month")!.value);
  return { start: new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10), end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
}

export function financialPlanPeriod(planMonth?: string): { start: string; end: string } {
  if (planMonth === undefined) return currentCalendarMonth();
  if (process.env.NODE_ENV === "production" || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(planMonth)) {
    throw new FinancialPlanInputError("Plan month overrides are only available in development with a valid YYYY-MM month");
  }
  return currentCalendarMonth(new Date(`${planMonth}-01T00:00:00+08:00`));
}

// The budget optimizer rejects a forecast whose month differs from the plan period.
export function forecastCoversPlanPeriod(forecast: ForecastPayload, period: { start: string }): boolean {
  return forecast.snapshot.month === period.start.slice(0, 7);
}

export function manilaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MANILA, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Commitments already paid this month are deducted so a mid-month plan does not reserve them twice.
export function remainingCommitmentCentavos(amountCentavos: number, paidCentavos: number): number {
  return Math.max(amountCentavos - paidCentavos, 0);
}

function addScheduleDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function addScheduleMonths(date: string, months: number, dayOfMonth?: number | null): string {
  const next = new Date(`${date}T00:00:00Z`);
  const day = dayOfMonth ?? next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next.toISOString().slice(0, 10);
}

function dateAtScheduleDay(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

type RecurrenceSchedule = { dayOfMonth?: number | null; intervalCount?: number | null; customIntervalDays?: number | null; semiMonthlyDays?: [number, number] | null };

function advanceReservationDate(date: string, frequency: string, schedule: RecurrenceSchedule): string | null {
  const interval = schedule.intervalCount && schedule.intervalCount > 0 ? schedule.intervalCount : 1;
  if (frequency === "daily") return addScheduleDays(date, interval);
  if (frequency === "weekly") return addScheduleDays(date, 7 * interval);
  if (frequency === "biweekly") return addScheduleDays(date, 14 * interval);
  if (frequency === "monthly") return addScheduleMonths(date, interval, schedule.dayOfMonth);
  if (frequency === "quarterly") return addScheduleMonths(date, 3 * interval);
  if (frequency === "yearly") return addScheduleMonths(date, 12 * interval);
  if (frequency === "custom") return schedule.customIntervalDays && schedule.customIntervalDays > 0 ? addScheduleDays(date, schedule.customIntervalDays) : null;
  if (frequency !== "semi_monthly") return null;

  const days = [...(schedule.semiMonthlyDays ?? [1, 15])].sort((left, right) => left - right);
  const current = new Date(`${date}T00:00:00Z`);
  const candidates = days.map((day) => dateAtScheduleDay(current.getUTCFullYear(), current.getUTCMonth(), day));
  return candidates.find((candidate) => candidate > date) ?? dateAtScheduleDay(current.getUTCFullYear(), current.getUTCMonth() + interval, days[0]!);
}

export function scheduledReservationDates(nextDate: string | null, frequency: string | null, period: { start: string; end: string }, schedule: RecurrenceSchedule = {}): string[] {
  if (!nextDate || !frequency) return [];
  const dates: string[] = [];
  let date: string | null = nextDate;
  for (let index = 0; date && date <= period.end && index < 10_000; index += 1) {
    if (date >= period.start) dates.push(date);
    date = advanceReservationDate(date, frequency, schedule);
  }
  return dates;
}

function fallbackForecast(period: { start: string; end: string }, categories: MlPlanCategory[]): MlExpenseForecastSnapshot {
  return {
    month: period.start.slice(0, 7),
    totalAmountCentavos: categories.reduce((sum, category) => sum + category.forecastCentavos, 0),
    categoryForecasts: categories.map((category) => ({ category: category.id, amountCentavos: category.forecastCentavos })),
    modelVersion: "odin-plan-fallback-v1",
    generatedAt: new Date().toISOString(),
    quality: "FALLBACK",
  };
}

function mapPlanForecast(
  userId: string,
  mlForecast: ForecastPayload,
  categories: MlPlanCategory[],
  categorySlugBySubcategoryId: Map<string, string | undefined>,
): MlExpenseForecastSnapshot {
  const forecastBySlug = new Map(mlForecast.snapshot.categoryForecasts.map((point) => [point.category, point.amountCentavos]));
  const targetsBySlug = new Map<string, MlPlanCategory[]>();
  for (const category of categories) {
    const slug = categorySlugBySubcategoryId.get(category.id);
    if (!slug) continue;
    targetsBySlug.set(slug, [...(targetsBySlug.get(slug) ?? []), category]);
  }
  const categoryForecasts = categories.map((category) => {
    const slug = categorySlugBySubcategoryId.get(category.id);
    const targets = slug ? targetsBySlug.get(slug) ?? [] : [];
    const total = slug ? forecastBySlug.get(slug) ?? 0 : 0;
    const totalWeight = targets.reduce((sum, target) => sum + target.forecastCentavos, 0);
    const mlDetail = slug ? mlForecast.forecasts.find((point) => point.category === slug) : undefined;
    // If this top-level category has no twelve-month spend, split its forecast evenly.
    const amount = totalWeight > 0
      ? total * category.forecastCentavos / totalWeight
      : total / targets.length;
    const finalForecastCentavos = Math.max(category.floorCentavos, amount);
    console.info("financial plan forecast decision", {
      user_id: userId,
      hfce_category: slug ?? null,
      target_id: category.id,
      ml_user_baseline_centavos: mlDetail?.userBaselineCentavos ?? null,
      ml_hfce_multiplier: mlDetail?.hfceMultiplier ?? null,
      parent_forecast_centavos: total,
      target_count: targets.length,
      spend_weight_centavos: category.forecastCentavos,
      total_weight_centavos: totalWeight,
      weight_percentage: totalWeight > 0 ? category.forecastCentavos / totalWeight * 100 : null,
       allocation_method: totalWeight > 0 ? "twelve_month_spend_weighted" : "even_split_no_spend_history",
      allocated_centavos: amount,
      floor_centavos: category.floorCentavos,
       final_forecast_centavos: finalForecastCentavos,
    });
    return { category: category.id, amountCentavos: finalForecastCentavos };
  });
  return { month: mlForecast.snapshot.month, totalAmountCentavos: categoryForecasts.reduce((sum, point) => sum + point.amountCentavos, 0), categoryForecasts, modelVersion: mlForecast.snapshot.modelVersion, generatedAt: mlForecast.snapshot.generatedAt, quality: mlForecast.snapshot.quality };
}

function mapRecommendation(categories: MlPlanCategory[], allocationAmounts: unknown): Array<{ categoryId: string | null; subcategoryId: string | null; allocationRule: MlPlanCategory["rule"]; allocatedAmountCentavos: number; floorAmountCentavos: number; ceilingAmountCentavos: number; forecastAmountCentavos: number }> {
  if (!Array.isArray(allocationAmounts) || allocationAmounts.length !== categories.length) throw new FinancialPlanUnavailableError("Budget optimizer returned an invalid recommendation");
  const amounts = new Map<string, number>();
  for (const allocation of allocationAmounts) {
    if (!allocation || typeof allocation !== "object") throw new FinancialPlanUnavailableError("Budget optimizer returned an invalid recommendation");
    const value = allocation as { category_id?: unknown; amount?: unknown };
    if (typeof value.category_id !== "string" || typeof value.amount !== "number" || !Number.isFinite(value.amount) || value.amount < 0 || amounts.has(value.category_id)) throw new FinancialPlanUnavailableError("Budget optimizer returned an invalid recommendation");
    amounts.set(value.category_id, value.amount * 100);
  }
  return categories.map((category) => {
    const amount = amounts.get(category.id);
    if (amount === undefined || amount < category.floorCentavos || amount > category.ceilingCentavos) throw new FinancialPlanUnavailableError("Budget optimizer returned an invalid recommendation");
    return { categoryId: category.target === "category" ? category.id : null, subcategoryId: category.target === "subcategory" ? category.id : null, allocationRule: category.rule, allocatedAmountCentavos: amount, floorAmountCentavos: category.floorCentavos, ceilingAmountCentavos: category.ceilingCentavos, forecastAmountCentavos: category.forecastCentavos };
  });
}

export function seasonalPreferencesFromAnswers(answers: Record<string, unknown>, periodStart: string): FinancialPlanEvidence["seasonalPreferences"] {
  const month = Number(periodStart.slice(5, 7));
  const higher = Array.isArray(answers.high_expense_seasons) ? answers.high_expense_seasons : [];
  const preferences = { saving_seasons: "saving", high_expense_seasons: "higher_expense", low_expense_seasons: "lower_expense" } as const;
  return (Object.keys(preferences) as Array<keyof typeof preferences>).flatMap((key) => {
    const selections = answers[key];
    if (!Array.isArray(selections)) return [];
    return [...new Set(selections)].flatMap((value) => {
      if (typeof value !== "string" || !SEASONAL_LABELS[value] || !SEASONAL_MONTHS[value]?.includes(month)) return [];
      if (key === "low_expense_seasons" && higher.includes(value)) return [];
      return [{ evidenceId: `${key}:${value}`, season: SEASONAL_LABELS[value]!, seasonWindow: SEASONAL_WINDOWS[value]!, preference: preferences[key] }];
    });
  });
}

function userFacingForecastRationale(value: string): string {
  return isUserFacingFinancialPlanExplanation(value) ? value : "";
}

export async function getFinancialPlanRecommendation(userId: string, supabase: SupabaseClient, plannedAmountCentavos: number, includedSubcategoryIds: string[] = [], includedCategoryIds: string[] = [], manualAllocations: ManualAllocation[] = [], reservationSkips: ReservationSkips = {}, planMonth?: string) {
  const period = financialPlanPeriod(planMonth);
  const statementPaymentWindowStart = addScheduleMonths(period.start, -1);
  const [subcategoriesResult, categoriesResult, accountsResult, debtsResult, goalsResult, statementsResult, transactionsResult, classificationResult, onboardingResult, cardPaymentsResult, debtPaymentsResult, scheduledPaymentsResult, scheduledPaidResult, scheduledPaymentTransactionsResult] = await Promise.all([
    supabase.from("subcategories").select("id, category_id, label, minimum_amount_centavos, fixed_amount_centavos, always_in_budget, updated_at").eq("user_id", userId).eq("kind", "expense").eq("is_active", true).eq("deleted", false).limit(200),
    supabase.from("categories").select("id, slug, label, minimum_amount_centavos, fixed_amount_centavos, updated_at").eq("user_id", userId).eq("is_active", true).eq("deleted", false).limit(200),
    supabase.from("financial_accounts").select("kind, current_balance_centavos, updated_at").eq("user_id", userId).eq("status", "active").eq("deleted", false).limit(100),
    supabase.from("debt_accounts").select("id, current_balance_centavos, minimum_payment_centavos, payment_frequency, payment_schedule, next_due_date, annual_interest_rate_bps, allows_extra_payments, updated_at").eq("user_id", userId).eq("status", "active").eq("deleted", false).limit(100),
    supabase.from("savings_goals").select("id, planned_contribution_amount_centavos, contribution_frequency, contribution_interval_count, contribution_day_of_month, contribution_second_day_of_month, custom_interval_days, next_contribution_date, goal_type, target_amount_centavos, current_amount_centavos, updated_at").eq("user_id", userId).eq("status", "active").eq("deleted", false).limit(100),
    supabase.from("credit_card_statements").select("id, minimum_due_centavos, due_date").eq("user_id", userId).eq("authoritative", true).eq("deleted", false).gte("due_date", period.start).lte("due_date", period.end).limit(100),
    supabase.from("transactions").select("id, amount_centavos, transaction_date, transaction_type, category_id, subcategory_id, source_savings_goal_id, destination_savings_goal_id, updated_at, anomaly_evaluations!anomaly_evaluations_transaction_id_fkey(transaction_id, is_anomaly)").eq("user_id", userId).eq("status", "posted").eq("deleted", false).eq("anomaly_evaluations.is_anomaly", true).order("transaction_date", { ascending: false }).limit(MAX_HISTORY),
    supabase.from("financial_condition_assessments").select("id, assessed_at, rule_set_version, output_snapshot").eq("user_id", userId).order("assessed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("onboarding_sessions").select("raw_answers").eq("user_id", userId).eq("status", "submitted").order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("credit_card_payments").select("statement_id, transaction_id, amount_centavos, payment_date").eq("user_id", userId).eq("deleted", false).gte("payment_date", statementPaymentWindowStart).lte("payment_date", period.end).limit(500),
    supabase.from("debt_payments").select("transaction_id").eq("user_id", userId).eq("deleted", false).gte("payment_date", period.start).lte("payment_date", period.end).not("transaction_id", "is", null).limit(500),
    supabase.from("scheduled_payments").select("id, name, subcategory_id, amount_centavos, frequency, due_day_of_month, due_second_day_of_month, due_day_of_week, due_month, starts_on, ends_on").eq("user_id", userId).eq("status", "active").eq("deleted", false).limit(200),
    supabase.from("scheduled_payment_records").select("scheduled_payment_id, occurrence_date, amount_centavos").eq("user_id", userId).eq("deleted", false).gte("occurrence_date", period.start).lte("occurrence_date", period.end).limit(1000),
    supabase.from("scheduled_payment_records").select("transaction_id").eq("user_id", userId).eq("deleted", false).gte("payment_date", period.start).lte("payment_date", period.end).limit(1000),
  ]);
  const inputFailures = [
    { source: "subcategories", error: subcategoriesResult.error },
    { source: "categories", error: categoriesResult.error },
    { source: "financial_accounts", error: accountsResult.error },
    { source: "debt_accounts", error: debtsResult.error },
    { source: "savings_goals", error: goalsResult.error },
    { source: "credit_card_statements", error: statementsResult.error },
    { source: "transactions", error: transactionsResult.error },
    { source: "onboarding_sessions", error: onboardingResult.error },
    { source: "credit_card_payments", error: cardPaymentsResult.error },
    { source: "debt_payments", error: debtPaymentsResult.error },
    { source: "scheduled_payments", error: scheduledPaymentsResult.error },
    { source: "scheduled_payment_records", error: scheduledPaidResult.error ?? scheduledPaymentTransactionsResult.error },
  ].flatMap(({ source, error }) => error ? [{
    source,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  }] : []);
  if (inputFailures.length) {
    console.error("financial plan inputs unavailable", {
      user_id: userId,
      failures: inputFailures,
    });
    throw new FinancialPlanUnavailableError("Financial plan inputs are unavailable");
  }
  const subcategories = (subcategoriesResult.data ?? []) as Subcategory[];
  if (!subcategories.length) throw new FinancialPlanInputError("No expense categories are configured");
  const availableMoney = ((accountsResult.data ?? []) as FinancialAccount[])
    .filter((account) => account.kind !== "savings" && account.kind !== "credit_card")
    .reduce((sum, account) => sum + account.current_balance_centavos, 0);
  if (availableMoney <= 0) throw new FinancialPlanInputError("No eligible financial-account balance is available");
  if (!Number.isSafeInteger(plannedAmountCentavos) || plannedAmountCentavos <= 0 || plannedAmountCentavos > availableMoney) throw new FinancialPlanInputError("Planning amount exceeds available money");
  const debtReservations = reservationSkips.skipDebtRepayments ? [] : ((debtsResult.data ?? []) as Debt[]).flatMap((debt) => debt.current_balance_centavos > 0 ? scheduledReservationDates(debt.next_due_date, debt.payment_frequency, period, debt.payment_schedule ?? {}).map((dueDate) => ({ debtAccountId: debt.id, creditCardStatementId: null, amountCentavos: Math.min(debt.current_balance_centavos, debt.minimum_payment_centavos), dueDate })) : []);
  const cardPayments = (cardPaymentsResult.data ?? []) as Array<CardPayment & { payment_date: string }>;
  const paidByStatement = new Map<string, number>();
  for (const payment of cardPayments) if (payment.statement_id) paidByStatement.set(payment.statement_id, (paidByStatement.get(payment.statement_id) ?? 0) + payment.amount_centavos);
  const statementReservations = reservationSkips.skipDebtRepayments ? [] : ((statementsResult.data ?? []) as Statement[]).flatMap((statement) => {
    const amountCentavos = remainingCommitmentCentavos(statement.minimum_due_centavos, paidByStatement.get(statement.id) ?? 0);
    return amountCentavos > 0 ? [{ debtAccountId: null, creditCardStatementId: statement.id, amountCentavos, dueDate: statement.due_date }] : [];
  });
  const savingsReservations = reservationSkips.skipSavingsContributions ? [] : ((goalsResult.data ?? []) as Goal[]).flatMap((goal) => (goal.planned_contribution_amount_centavos ?? 0) > 0 ? scheduledReservationDates(goal.next_contribution_date, goal.contribution_frequency, period, { dayOfMonth: goal.contribution_day_of_month, intervalCount: goal.contribution_interval_count, customIntervalDays: goal.custom_interval_days, semiMonthlyDays: goal.contribution_day_of_month != null && goal.contribution_second_day_of_month != null ? [goal.contribution_day_of_month, goal.contribution_second_day_of_month] : null }).map((dueDate) => ({ savingsGoalId: goal.id, amountCentavos: goal.planned_contribution_amount_centavos!, dueDate })) : []);
  const scheduledPayments = (scheduledPaymentsResult.data ?? []) as Array<ScheduledPaymentRow & { name: string; subcategory_id: string | null }>;
  const scheduledPaymentById = new Map(scheduledPayments.map((payment) => [payment.id, payment]));
  const obligations = scheduledPaymentReservations(scheduledPayments, (scheduledPaidResult.data ?? []) as { scheduled_payment_id: string; occurrence_date: string; amount_centavos: number }[], period).map((reservation) => ({ ...reservation, label: scheduledPaymentById.get(reservation.scheduledPaymentId)?.name, subcategoryId: scheduledPaymentById.get(reservation.scheduledPaymentId)?.subcategory_id }));
  const reserved = [...debtReservations, ...statementReservations, ...savingsReservations, ...obligations].reduce((sum, item) => sum + item.amountCentavos, 0);
  const available = plannedAmountCentavos - reserved;
  const explanationContext = buildFinancialPlanExplanationContext({
    planMonth: period.start.slice(0, 7), plannedAmountCentavos, categoryBudgetCentavos: available,
    debtReservations: [...debtReservations, ...statementReservations], savingsReservations, obligations,
    scheduledPayments: (scheduledPaymentsResult.data ?? []) as Array<ScheduledPaymentRow & { subcategory_id: string | null }>,
    subcategories, categories: (categoriesResult.data ?? []) as Category[],
  });
  const seasonalPreferences = seasonalPreferencesFromAnswers(((onboardingResult.data as OnboardingSession | null)?.raw_answers ?? {}), period.start);
  const transactions = (transactionsResult.data ?? []) as TransactionWithAnomalies[];
  const unusualTransactionIds = new Set(transactions.flatMap((transaction) => (transaction.anomaly_evaluations ?? [])
    .filter((evaluation) => evaluation.is_anomaly)
    .map((evaluation) => evaluation.transaction_id)));
  const cleanTransactions = excludeUnusualTransactions(transactions, unusualTransactionIds);
  const trailingTwelveMonths = new Date();
  trailingTwelveMonths.setUTCMonth(trailingTwelveMonths.getUTCMonth() - 12);
  const trailingTwelveMonthsStart = trailingTwelveMonths.toISOString().slice(0, 10);
  const parentBySubcategory = new Map(subcategories.map((subcategory) => [subcategory.id, subcategory.category_id]));
  const spendBySubcategory = new Map<string, number>();
  const spendByCategory = new Map<string, number>();
  const spendMonths = new Set<string>();
  for (const transaction of cleanTransactions) {
    if (transaction.transaction_type === "expense" && transaction.transaction_date >= trailingTwelveMonthsStart) spendMonths.add(transaction.transaction_date.slice(0, 7));
    if (transaction.transaction_type === "expense" && transaction.subcategory_id && transaction.transaction_date >= trailingTwelveMonthsStart) {
      spendBySubcategory.set(transaction.subcategory_id, (spendBySubcategory.get(transaction.subcategory_id) ?? 0) + transaction.amount_centavos);
    }
    const parentCategoryId = (transaction.subcategory_id ? parentBySubcategory.get(transaction.subcategory_id) : null) ?? transaction.category_id;
    if (transaction.transaction_type === "expense" && parentCategoryId && transaction.transaction_date >= trailingTwelveMonthsStart) spendByCategory.set(parentCategoryId, (spendByCategory.get(parentCategoryId) ?? 0) + transaction.amount_centavos);
  }
  // Spend totals cover up to twelve months; a fallback forecast needs one month's worth.
  const monthlySpend = (totalCentavos: number | undefined) => (totalCentavos ?? 0) / Math.max(spendMonths.size, 1);
  const slugByCategoryId = new Map(((categoriesResult.data ?? []) as Category[]).map((category) => [category.id, category.slug]));
  const categorySlugBySubcategoryId = new Map([
    ...subcategories.map((subcategory) => [subcategory.id, subcategory.category_id ? slugByCategoryId.get(subcategory.category_id) : undefined] as const),
    ...slugByCategoryId.entries(),
  ]);
  const includedIds = new Set(includedSubcategoryIds);
  const includedTopLevelIds = new Set(includedCategoryIds);
  const manualFloorByTarget = new Map(manualAllocations.map((allocation) => [`${allocation.target}:${allocation.id}`, allocation.amountCentavos]));
  for (const allocation of manualAllocations) {
    const isIncluded = allocation.target === "subcategory" ? includedIds.has(allocation.id) : includedTopLevelIds.has(allocation.id);
    const hasHistory = allocation.target === "subcategory" ? spendBySubcategory.has(allocation.id) : spendByCategory.has(allocation.id);
    const category = allocation.target === "subcategory" ? subcategories.find((item) => item.id === allocation.id) : ((categoriesResult.data ?? []) as Category[]).find((item) => item.id === allocation.id);
    if (!isIncluded || hasHistory || !category || category.minimum_amount_centavos !== null || category.fixed_amount_centavos !== null) throw new FinancialPlanInputError("Manual allocation is only available for selected categories without history");
  }
  const grossCategories: MlPlanCategory[] = [
    ...((categoriesResult.data ?? []) as Category[]).flatMap((category) => {
      const fixed = category.fixed_amount_centavos;
      const minimum = category.minimum_amount_centavos ?? 0;
      if (fixed === null && category.minimum_amount_centavos === null && !includedTopLevelIds.has(category.id)) return [];
      const rule: MlPlanCategory["rule"] = fixed !== null ? "FIXED" : (category.minimum_amount_centavos !== null ? "MINIMUM" : "FLEXIBLE");
      const floor = fixed ?? Math.max(minimum, manualFloorByTarget.get(`category:${category.id}`) ?? 0);
      return [{ id: category.id, target: "category" as const, priorityGroup: financialPlanPriorityGroup(category.slug), priorityWeight: 1, rule, floorCentavos: floor, ceilingCentavos: fixed ?? Math.max(available, floor), forecastCentavos: monthlySpend(spendByCategory.get(category.id)) }];
    }),
    ...subcategories.flatMap((subcategory) => {
    const fixed = subcategory.fixed_amount_centavos;
    const minimum = subcategory.minimum_amount_centavos ?? 0;
    const automaticallyIncluded = fixed !== null || subcategory.minimum_amount_centavos !== null;
    if (!automaticallyIncluded && !includedIds.has(subcategory.id)) return [];
    const rule: MlPlanCategory["rule"] = fixed !== null ? "FIXED" : (subcategory.minimum_amount_centavos !== null ? "MINIMUM" : "FLEXIBLE");
    const floor = fixed ?? Math.max(minimum, manualFloorByTarget.get(`subcategory:${subcategory.id}`) ?? 0);
    return [{ id: subcategory.id, target: "subcategory" as const, priorityGroup: financialPlanPriorityGroup(subcategory.category_id ? slugByCategoryId.get(subcategory.category_id) : undefined), priorityWeight: 1, rule, floorCentavos: floor, ceilingCentavos: fixed ?? Math.max(available, floor), forecastCentavos: monthlySpend(spendBySubcategory.get(subcategory.id)) }];
  }),
  ];
  const scheduledByTarget = scheduledCategoryAmounts(scheduledPayments, grossCategories, parentBySubcategory, period);
  const categories = subtractScheduledRequirements(grossCategories, scheduledByTarget);
  const categoryBaselines = subtractScheduledAmounts(new Map([...spendByCategory, ...spendBySubcategory].map(([id, amount]) => [id, monthlySpend(amount)])), scheduledByTarget);
  if (!categories.length) throw new FinancialPlanInputError("Choose at least one expense category");
  const minimumRequired = categories.reduce((sum, category) => sum + category.floorCentavos, 0);
  if (isFinancialPlanInfeasible(available, minimumRequired)) {
    const forecast = fallbackForecast(period, categories);
    const inputSnapshot = { plannedAmountCentavos, forecast, restrictions: { allocations: categories }, obligations: { reservations: obligations }, debtRequirements: { reservations: [...debtReservations, ...statementReservations] }, savingsRequirements: { reservations: savingsReservations }, classification: classificationResult.data ?? { status: "unavailable" } };
    const requiredFundsCentavos = reserved + minimumRequired;
    const shortfallCentavos = Math.max(0, requiredFundsCentavos - plannedAmountCentavos);
    const explanationEvidence: FinancialPlanEvidence = { ...explanationContext, planPeriodLabel: new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: MANILA }).format(new Date(`${period.start}T00:00:00Z`)), surplusCentavos: 0, debtSurplusCentavos: 0, savingsSurplusCentavos: 0, shortfall: { plannedAmountCentavos, requiredFundsCentavos, shortfallCentavos }, seasonalPreferences, forecastChanges: [] };
    const explanationRequest: FinancialPlanExplanationRequest = { evidence: explanationEvidence, leading: [] };
    return { status: "INFEASIBLE" as const, period, inputSnapshot: { ...inputSnapshot, spendingExplanationEvidence: explanationEvidence }, recommendation: { availableFundsCentavos: available, requiredFundsCentavos, shortfallCentavos, allocations: categories.map((category) => ({ categoryId: category.target === "category" ? category.id : null, subcategoryId: category.target === "subcategory" ? category.id : null, allocationRule: category.rule, allocatedAmountCentavos: category.floorCentavos, floorAmountCentavos: category.floorCentavos, ceilingAmountCentavos: category.ceilingCentavos, forecastAmountCentavos: category.forecastCentavos })), debtReservations: [...debtReservations, ...statementReservations], savingsReservations }, explanations: deterministicFinancialPlanExplanations(explanationRequest), explanationRequest };
  }
  // Neither depends on the forecast, so they run while the forecast is fetched instead of after it.
  // The no-op catches keep an early throw below from leaving these rejections unhandled; the awaits still see them.
  const assessmentPromise = createFinancialConditionAssessment(userId, getServiceRoleClient());
  const debtPreferencesPromise = Promise.all([
    supabase.from("debt_strategy_preferences").select("strategy").eq("user_id", userId).eq("deleted", false).maybeSingle(),
    supabase.from("user_debt_priorities").select("debt_account_id, priority_rank").eq("user_id", userId).eq("deleted", false).order("priority_rank").limit(100),
  ]);
  assessmentPromise.catch(() => {});
  debtPreferencesPromise.catch(() => {});
  let forecast = fallbackForecast(period, categories);
  let forecastDetails: ForecastPayload["forecasts"] = [];
  let forecastUnavailableMessage: string | null = null;
  try {
    const plannedSubcategoryIds = new Set(categories.map((category) => category.id));
    const forecastTransactions = cleanTransactions.flatMap((transaction) => {
      const category = transaction.subcategory_id ? categorySlugBySubcategoryId.get(transaction.subcategory_id) : slugByCategoryId.get(transaction.category_id ?? "");
      const parentId = (transaction.subcategory_id ? parentBySubcategory.get(transaction.subcategory_id) : null) ?? transaction.category_id;
      const targetId = transaction.subcategory_id && plannedSubcategoryIds.has(transaction.subcategory_id) ? transaction.subcategory_id : parentId;
      return category && targetId && plannedSubcategoryIds.has(targetId)
        ? [{ transactionId: transaction.id, date: transaction.transaction_date, amount: transaction.amount_centavos / 100, category, transactionType: transaction.transaction_type }]
        : [];
    });
    if (forecastTransactions.length) {
      const mlForecast = await getMlForecast(userId, { historicalTransactions: forecastTransactions, targetMonth: period.start.slice(0, 7) });
      if (forecastCoversPlanPeriod(mlForecast, period)) {
        // Apply the forecast's change only to the baseline remaining after scheduled payments.
        const forecastDeductions = new Map([...scheduledByTarget].map(([id, amount]) => {
          const detail = mlForecast.forecasts.find((point) => point.category === categorySlugBySubcategoryId.get(id));
          const factor = detail && detail.userBaselineCentavos > 0 ? detail.amountCentavos / detail.userBaselineCentavos : 1;
          return [id, amount * factor];
        }));
        forecast = subtractScheduledForecast(mapPlanForecast(userId, mlForecast, grossCategories, categorySlugBySubcategoryId), forecastDeductions, new Map(categories.map((category) => [category.id, category.floorCentavos])));
        forecastDetails = mlForecast.forecasts;
      } else {
        console.warn("financial plan forecast month mismatch; using spend fallback", { user_id: userId, forecast_month: mlForecast.snapshot.month, plan_month: period.start.slice(0, 7) });
      }
    }
  } catch (error) {
    if (!(error instanceof ForecastValidationError || error instanceof ForecastUpstreamError || error instanceof ForecastUnavailableError)) throw error;
    console.warn("financial plan forecast unavailable; using spend fallback", { user_id: userId, error: error.message });
    if (error instanceof ForecastUnavailableError) forecastUnavailableMessage = error.message;
  }
  const plannedCategories = applyFinancialPlanPriorityWeights(categories.map((category) => ({ ...category, forecastCentavos: forecast.categoryForecasts.find((point) => point.category === category.id)?.amountCentavos ?? category.floorCentavos })), categoryBaselines);
  const freshAssessment = await assessmentPromise;
  const assessmentRow = freshAssessment ?? (classificationResult.error ? null : classificationResult.data as { id: string; assessed_at: string; rule_set_version: string; output_snapshot: unknown } | null);
  const assessment = assessmentRow && assessmentRow.output_snapshot && typeof assessmentRow.output_snapshot === "object" && !Array.isArray(assessmentRow.output_snapshot)
    ? { id: assessmentRow.id, assessedAt: assessmentRow.assessed_at, ruleSetVersion: assessmentRow.rule_set_version, outputSnapshot: assessmentRow.output_snapshot as Record<string, unknown> }
    : null;
  const sourceUpdatedAt = latestSourceUpdate(subcategoriesResult.data ?? [], categoriesResult.data ?? [], accountsResult.data ?? [], debtsResult.data ?? [], goalsResult.data ?? [], transactionsResult.data ?? []);
  const goals = (goalsResult.data ?? []) as Goal[];
  const debts = (debtsResult.data ?? []) as Debt[];
  const eligibleEmergencyGoalId = goals.find((goal) => goal.goal_type === "emergency_fund" && goal.current_amount_centavos < goal.target_amount_centavos)?.id ?? null;
  const [strategyResult, prioritiesResult] = await debtPreferencesPromise;
  const strategy = strategyResult.data?.strategy === "snowball" ? "snowball" : "avalanche";
  const priorityIds = (prioritiesResult.data ?? []).map((priority) => priority.debt_account_id).filter((id): id is string => typeof id === "string");
  const eligibleDebtId = strategyResult.error || prioritiesResult.error ? null : selectEligibleDebt(debts, strategy, priorityIds);
  const inputSnapshot = { plannedAmountCentavos, forecast, restrictions: { allocations: plannedCategories }, obligations: { reservations: obligations }, debtRequirements: { reservations: [...debtReservations, ...statementReservations] }, savingsRequirements: { reservations: savingsReservations }, classification: assessment ? { assessmentId: assessment.id, assessedAt: assessment.assessedAt, ruleSetVersion: assessment.ruleSetVersion, outputSnapshot: assessment.outputSnapshot, sourceUpdatedAt } : { status: classificationResult.error ? "unavailable" : "absent", sourceUpdatedAt } };
  // Recommendations use monthly targets; recorded spending is tracked separately.
  const ml = await recommendPlanCategories(userId, period, available, plannedCategories, forecast);
  const recommendation = ml.recommendation as { feasibility?: string; required_funds?: number; shortfall?: number; unallocated_surplus?: number; allocations?: unknown };
  const surplusCentavos = typeof recommendation.unallocated_surplus === "number" && Number.isFinite(recommendation.unallocated_surplus) && recommendation.unallocated_surplus > 0 ? recommendation.unallocated_surplus * 100 : 0;
  const surplusRecommendation = deriveSurplusRecommendation({ unallocatedSurplusCentavos: surplusCentavos, assessment, sourceUpdatedAt, eligibleEmergencyGoalId, eligibleDebtId });
  const debtSurplusCentavos = 0;
  const savingsSurplusCentavos = 0;
  const baseDebtReservations = [...debtReservations, ...statementReservations];
  const allocations = mapRecommendation(plannedCategories, recommendation.allocations);
  const categoryLabelById = new Map([...((categoriesResult.data ?? []) as Category[]), ...subcategories].map((category) => [category.id, category.label]));
  const zeroAllocationInsights = zeroAllocationExplanations(allocations.flatMap((allocation) => {
    const targetId = allocation.categoryId ?? allocation.subcategoryId;
    const category = targetId ? plannedCategories.find((item) => item.id === targetId) : undefined;
    if (!category) return [];
    return [{ categoryName: categoryLabelById.get(category.id) ?? category.id, allocationCentavos: allocation.allocatedAmountCentavos, requiredFloorCentavos: category.floorCentavos, forecastCentavos: category.forecastCentavos }];
  }));
  const plannedInputSnapshot = { ...inputSnapshot, debtRequirements: { reservations: baseDebtReservations, surplusCentavos: debtSurplusCentavos }, savingsRequirements: { reservations: savingsReservations, surplusCentavos: savingsSurplusCentavos } };
  const categoryBySlug = new Map(((categoriesResult.data ?? []) as Category[]).map((category) => [category.slug, category]));
  const forecastChanges = forecastDetails.flatMap((detail) => {
    const category = categoryBySlug.get(detail.category);
    if (!category) return [];
    const categoryAllocations = allocations.filter((allocation) => {
      const targetId = allocation.categoryId ?? allocation.subcategoryId;
      return targetId && categorySlugBySubcategoryId.get(targetId) === detail.category;
    });
    if (categoryAllocations.length === 0) return [];
    const allocationCentavos = categoryAllocations.reduce((sum, allocation) => sum + allocation.allocatedAmountCentavos, 0);
    const scheduledCentavos = categories.filter((target) => categorySlugBySubcategoryId.get(target.id) === detail.category).reduce((sum, target) => sum + (scheduledByTarget.get(target.id) ?? 0), 0);
    const baselineCentavos = Math.max(0, detail.userBaselineCentavos - scheduledCentavos);
    const factor = detail.userBaselineCentavos > 0 ? detail.amountCentavos / detail.userBaselineCentavos : 1;
    const forecastCentavos = Math.max(0, detail.amountCentavos - scheduledCentavos * factor);
    const differenceCentavos = forecastCentavos - baselineCentavos;
    return [{ evidenceId: `forecast:${detail.category}`, categoryName: category.label, categorySlug: detail.category, baselineCentavos, forecastCentavos, allocationCentavos, allocationForecastDifferenceCentavos: allocationCentavos - forecastCentavos, differenceCentavos, percentageChange: baselineCentavos > 0 ? differenceCentavos / baselineCentavos * 100 : null, forecastRationale: userFacingForecastRationale(detail.explanation), possibleSeasonalContext: null }];
  });
  const explanationEvidence: FinancialPlanEvidence = { ...explanationContext, planPeriodLabel: new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: MANILA }).format(new Date(`${period.start}T00:00:00Z`)), surplusCentavos, debtSurplusCentavos, savingsSurplusCentavos, seasonalPreferences, forecastChanges };
  // Groq explanations are fetched separately (POST /financial-plans/explanations) so the plan is not held up by them.
  const explanationRequest: FinancialPlanExplanationRequest = { evidence: explanationEvidence, leading: [...(forecastUnavailableMessage ? [forecastUnavailableMessage] : []), ...zeroAllocationInsights] };
  return { status: recommendation.feasibility === "INFEASIBLE" ? "INFEASIBLE" as const : "RECOMMENDATION_READY" as const, period, inputSnapshot: { ...plannedInputSnapshot, spendingExplanationEvidence: explanationEvidence }, recommendation: { availableFundsCentavos: available, requiredFundsCentavos: typeof recommendation.required_funds === "number" ? recommendation.required_funds * 100 : undefined, shortfallCentavos: typeof recommendation.shortfall === "number" ? recommendation.shortfall * 100 : undefined, allocations, debtReservations: baseDebtReservations, debtSurplusCentavos, savingsReservations, savingsSurplusCentavos, surplusRecommendation }, explanations: deterministicFinancialPlanExplanations(explanationRequest), explanationRequest };
}
