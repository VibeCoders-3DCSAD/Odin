import type { SupabaseClient } from "@supabase/supabase-js";
import { ForecastUpstreamError, ForecastValidationError, getMlForecast, type ForecastPayload } from "../forecastService.js";
import { recommendPlanCategories, type MlExpenseForecastSnapshot, type MlPlanCategory } from "./mlAdapter.js";
import { explainFinancialPlan, fallbackFinancialPlanExplanations, isUserFacingFinancialPlanExplanation, zeroAllocationExplanations, type FinancialPlanEvidence } from "./explanationService.js";
import { deriveSurplusRecommendation } from "./classificationPolicy.js";
import { createFinancialConditionAssessment } from "../financialConditionAssessmentService.js";
import { getServiceRoleClient } from "../../lib/supabase.js";

const MANILA = "Asia/Manila";
const MAX_HISTORY = 500;
const ESSENTIAL_HFCE_CATEGORY_SLUGS = new Set(["food", "housing_water_utilities", "health", "communication", "transport", "education", "furnishings_household", "clothing_footwear"]);
const SEASONAL_LABELS: Record<string, string> = { rainy_season: "Rainy Season", back_to_school: "Back-to-School Season", undas: "Undas / All Souls' Day", christmas_ber_months: "Christmas and Ber Months", new_year: "New Year", summer: "Summer", annual_payments: "Tax and Annual-Payment Season", family_celebrations: "Birthday and Family-Celebration Months" };
const SEASONAL_WINDOWS: Record<string, string> = { rainy_season: "June to November", back_to_school: "June to August", undas: "October to November", christmas_ber_months: "September to December", new_year: "January", summer: "March to May", annual_payments: "January to April", family_celebrations: "varies by the selected month" };
const SEASONAL_MONTHS: Record<string, number[]> = { rainy_season: [6, 7, 8, 9, 10, 11], back_to_school: [6, 7, 8], undas: [10, 11], christmas_ber_months: [9, 10, 11, 12], new_year: [1], summer: [3, 4, 5], annual_payments: [1, 2, 3, 4], family_celebrations: [] };

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

// Spending already posted this month is gone from account balances, so the plan only funds what remains.
// Debt and card payments and savings transfers are excluded; those are commitments, not category spending.
export function monthToDateSpendById(transactions: Transaction[], window: { start: string; end: string }, plannedTargets: Pick<MlPlanCategory, "id" | "target">[], parentCategoryBySubcategory: Map<string, string | null>, excludedTransactionIds: Set<string>): Map<string, number> {
  const plannedSubcategoryIds = new Set(plannedTargets.flatMap((target) => target.target === "subcategory" ? [target.id] : []));
  const plannedCategoryIds = new Set(plannedTargets.flatMap((target) => target.target === "category" ? [target.id] : []));
  const spend = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.transaction_type !== "expense" || transaction.transaction_date < window.start || transaction.transaction_date > window.end) continue;
    if (excludedTransactionIds.has(transaction.id) || transaction.source_savings_goal_id || transaction.destination_savings_goal_id) continue;
    const parentCategoryId = (transaction.subcategory_id ? parentCategoryBySubcategory.get(transaction.subcategory_id) : null) ?? transaction.category_id;
    const targetId = transaction.subcategory_id && plannedSubcategoryIds.has(transaction.subcategory_id) ? transaction.subcategory_id : parentCategoryId && plannedCategoryIds.has(parentCategoryId) ? parentCategoryId : null;
    if (targetId) spend.set(targetId, (spend.get(targetId) ?? 0) + transaction.amount_centavos);
  }
  return spend;
}

export function monthToDateAddBackCentavos(category: Pick<MlPlanCategory, "rule" | "floorCentavos">, spentCentavos: number): number {
  return category.rule === "FIXED" ? Math.min(spentCentavos, category.floorCentavos) : spentCentavos;
}

export function toRemainingPlanCategory(category: MlPlanCategory, spentCentavos: number, availableCentavos: number): MlPlanCategory {
  const floorCentavos = Math.max(category.floorCentavos - spentCentavos, 0);
  return { ...category, floorCentavos, ceilingCentavos: category.rule === "FIXED" ? floorCentavos : Math.max(availableCentavos, floorCentavos), forecastCentavos: Math.max(category.forecastCentavos - spentCentavos, 0) };
}

export function toRemainingForecast(forecast: MlExpenseForecastSnapshot, spentById: Map<string, number>): MlExpenseForecastSnapshot {
  const categoryForecasts = forecast.categoryForecasts.map((point) => ({ ...point, amountCentavos: Math.max(point.amountCentavos - (spentById.get(point.category) ?? 0), 0) }));
  const deductedCentavos = forecast.categoryForecasts.reduce((sum, point, index) => sum + point.amountCentavos - categoryForecasts[index]!.amountCentavos, 0);
  return { ...forecast, totalAmountCentavos: Math.max(forecast.totalAmountCentavos - deductedCentavos, 0), categoryForecasts };
}

// Stored allocations cover the whole month: what was already spent plus what the optimizer funded for the rest of it.
export function restoreMonthToDateSpending<T extends { allocatedAmountCentavos: number; floorAmountCentavos: number; ceilingAmountCentavos: number; forecastAmountCentavos: number }>(allocations: T[], wholeMonthCategories: MlPlanCategory[], spentById: Map<string, number>): T[] {
  return allocations.map((allocation, index) => {
    const category = wholeMonthCategories[index]!;
    const addBack = monthToDateAddBackCentavos(category, spentById.get(category.id) ?? 0);
    return { ...allocation, allocatedAmountCentavos: allocation.allocatedAmountCentavos + addBack, floorAmountCentavos: category.floorCentavos, ceilingAmountCentavos: category.rule === "FIXED" ? category.floorCentavos : allocation.ceilingAmountCentavos + addBack, forecastAmountCentavos: category.forecastCentavos };
  });
}

function addScheduleDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function addScheduleMonths(date: string, months: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  const day = next.getUTCDate();
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

type RecurrenceSchedule = { intervalCount?: number | null; customIntervalDays?: number | null; semiMonthlyDays?: [number, number] | null };

function advanceReservationDate(date: string, frequency: string, schedule: RecurrenceSchedule): string | null {
  const interval = schedule.intervalCount && schedule.intervalCount > 0 ? schedule.intervalCount : 1;
  if (frequency === "daily") return addScheduleDays(date, interval);
  if (frequency === "weekly") return addScheduleDays(date, 7 * interval);
  if (frequency === "biweekly") return addScheduleDays(date, 14 * interval);
  if (frequency === "monthly") return addScheduleMonths(date, interval);
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
    const orderedTargets = [...targets].sort((left, right) => left.id.localeCompare(right.id));
    const index = orderedTargets.findIndex((target) => target.id === category.id);
    const mlDetail = slug ? mlForecast.forecasts.find((point) => point.category === slug) : undefined;
    // If this top-level category has no twelve-month spend, split its forecast evenly.
    const precedingWeight = orderedTargets.slice(0, index).reduce((sum, target) => sum + target.forecastCentavos, 0);
    const amount = totalWeight > 0
      ? Math.floor(total * (precedingWeight + category.forecastCentavos) / totalWeight) - Math.floor(total * precedingWeight / totalWeight)
      : Math.floor(total * (index + 1) / orderedTargets.length) - Math.floor(total * index / orderedTargets.length);
    const finalForecastCentavos = Math.round(Math.max(category.floorCentavos, amount) / 100) * 100;
    console.info("financial plan forecast decision", {
      user_id: userId,
      hfce_category: slug ?? null,
      target_id: category.id,
      ml_user_baseline_centavos: mlDetail?.userBaselineCentavos ?? null,
      ml_hfce_multiplier: mlDetail?.hfceMultiplier ?? null,
      parent_forecast_centavos: total,
      target_count: orderedTargets.length,
      spend_weight_centavos: category.forecastCentavos,
      total_weight_centavos: totalWeight,
      weight_percentage: totalWeight > 0 ? Number((category.forecastCentavos / totalWeight * 100).toFixed(4)) : null,
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
    amounts.set(value.category_id, Math.round(value.amount * 100));
  }
  return categories.map((category) => {
    const amount = amounts.get(category.id);
    if (amount === undefined || amount < category.floorCentavos || amount > category.ceilingCentavos) throw new FinancialPlanUnavailableError("Budget optimizer returned an invalid recommendation");
    return { categoryId: category.target === "category" ? category.id : null, subcategoryId: category.target === "subcategory" ? category.id : null, allocationRule: category.rule, allocatedAmountCentavos: amount, floorAmountCentavos: category.floorCentavos, ceilingAmountCentavos: category.ceilingCentavos, forecastAmountCentavos: category.forecastCentavos };
  });
}

export function seasonalPreferencesFromAnswers(answers: Record<string, unknown>, periodStart: string): FinancialPlanEvidence["seasonalPreferences"] {
  const month = Number(periodStart.slice(5, 7));
  return ["saving_seasons", "high_expense_seasons"].flatMap((key) => Array.isArray(answers[key]) ? answers[key].flatMap((value) => typeof value === "string" && SEASONAL_LABELS[value] && SEASONAL_MONTHS[value]?.includes(month) ? [{ evidenceId: `${key}:${value}`, season: SEASONAL_LABELS[value], seasonWindow: SEASONAL_WINDOWS[value] ?? "not specified", preference: key === "saving_seasons" ? "saving" as const : "higher_expense" as const }] : []) : []);
}

function userFacingForecastRationale(value: string): string {
  return isUserFacingFinancialPlanExplanation(value) ? value : "";
}

export async function getFinancialPlanRecommendation(userId: string, supabase: SupabaseClient, plannedAmountCentavos: number, includedSubcategoryIds: string[] = [], includedCategoryIds: string[] = [], manualAllocations: ManualAllocation[] = [], reservationSkips: ReservationSkips = {}) {
  const period = currentCalendarMonth();
  const statementPaymentWindowStart = addScheduleMonths(period.start, -1);
  const [subcategoriesResult, categoriesResult, accountsResult, debtsResult, goalsResult, statementsResult, transactionsResult, classificationResult, onboardingResult, cardPaymentsResult, debtPaymentsResult] = await Promise.all([
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
  const today = manilaToday();
  const monthToDate = { start: period.start, end: today < period.end ? today : period.end };
  const cardPayments = (cardPaymentsResult.data ?? []) as Array<CardPayment & { payment_date: string }>;
  const paidByStatement = new Map<string, number>();
  for (const payment of cardPayments) if (payment.statement_id) paidByStatement.set(payment.statement_id, (paidByStatement.get(payment.statement_id) ?? 0) + payment.amount_centavos);
  const statementReservations = reservationSkips.skipDebtRepayments ? [] : ((statementsResult.data ?? []) as Statement[]).flatMap((statement) => {
    const amountCentavos = remainingCommitmentCentavos(statement.minimum_due_centavos, paidByStatement.get(statement.id) ?? 0);
    return amountCentavos > 0 ? [{ debtAccountId: null, creditCardStatementId: statement.id, amountCentavos, dueDate: statement.due_date }] : [];
  });
  const savingsReservations = reservationSkips.skipSavingsContributions ? [] : ((goalsResult.data ?? []) as Goal[]).flatMap((goal) => (goal.planned_contribution_amount_centavos ?? 0) > 0 ? scheduledReservationDates(goal.next_contribution_date, goal.contribution_frequency, period, { intervalCount: goal.contribution_interval_count, customIntervalDays: goal.custom_interval_days, semiMonthlyDays: goal.contribution_day_of_month != null && goal.contribution_second_day_of_month != null ? [goal.contribution_day_of_month, goal.contribution_second_day_of_month] : null }).map((dueDate) => ({ savingsGoalId: goal.id, amountCentavos: goal.planned_contribution_amount_centavos!, dueDate })) : []);
  const reserved = [...debtReservations, ...statementReservations, ...savingsReservations].reduce((sum, item) => sum + item.amountCentavos, 0);
  const available = plannedAmountCentavos - reserved;
  const seasonalPreferences = seasonalPreferencesFromAnswers(((onboardingResult.data as OnboardingSession | null)?.raw_answers ?? {}), period.start);
  const transactions = (transactionsResult.data ?? []) as TransactionWithAnomalies[];
  const unusualTransactionIds = new Set(transactions.flatMap((transaction) => (transaction.anomaly_evaluations ?? [])
    .filter((evaluation) => evaluation.is_anomaly)
    .map((evaluation) => evaluation.transaction_id)));
  const cleanTransactions = excludeUnusualTransactions(transactions, unusualTransactionIds);
  const trailingTwelveMonths = new Date();
  trailingTwelveMonths.setUTCMonth(trailingTwelveMonths.getUTCMonth() - 12);
  const trailingTwelveMonthsStart = trailingTwelveMonths.toISOString().slice(0, 10);
  const spendBySubcategory = new Map<string, number>();
  const spendByCategory = new Map<string, number>();
  for (const transaction of cleanTransactions) {
    if (transaction.transaction_type === "expense" && transaction.subcategory_id && transaction.transaction_date >= trailingTwelveMonthsStart) {
      spendBySubcategory.set(transaction.subcategory_id, (spendBySubcategory.get(transaction.subcategory_id) ?? 0) + transaction.amount_centavos);
    }
    if (transaction.transaction_type === "expense" && transaction.category_id && !transaction.subcategory_id && transaction.transaction_date >= trailingTwelveMonthsStart) spendByCategory.set(transaction.category_id, (spendByCategory.get(transaction.category_id) ?? 0) + transaction.amount_centavos);
  }
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
  const categories: MlPlanCategory[] = [
    ...((categoriesResult.data ?? []) as Category[]).flatMap((category) => {
      const fixed = category.fixed_amount_centavos;
      const minimum = category.minimum_amount_centavos ?? 0;
      if (fixed === null && category.minimum_amount_centavos === null && !includedTopLevelIds.has(category.id)) return [];
      const rule: MlPlanCategory["rule"] = fixed !== null ? "FIXED" : (category.minimum_amount_centavos !== null ? "MINIMUM" : "FLEXIBLE");
      const floor = fixed ?? Math.max(minimum, manualFloorByTarget.get(`category:${category.id}`) ?? 0);
      return [{ id: category.id, target: "category" as const, priorityGroup: financialPlanPriorityGroup(category.slug), priorityWeight: 1, rule, floorCentavos: floor, ceilingCentavos: fixed ?? Math.max(available, floor), forecastCentavos: spendByCategory.get(category.id) ?? 0 }];
    }),
    ...subcategories.flatMap((subcategory) => {
    const fixed = subcategory.fixed_amount_centavos;
    const minimum = subcategory.minimum_amount_centavos ?? 0;
    const automaticallyIncluded = fixed !== null || subcategory.minimum_amount_centavos !== null;
    if (!automaticallyIncluded && !includedIds.has(subcategory.id)) return [];
    const rule: MlPlanCategory["rule"] = fixed !== null ? "FIXED" : (subcategory.minimum_amount_centavos !== null ? "MINIMUM" : "FLEXIBLE");
    const floor = fixed ?? Math.max(minimum, manualFloorByTarget.get(`subcategory:${subcategory.id}`) ?? 0);
    return [{ id: subcategory.id, target: "subcategory" as const, priorityGroup: financialPlanPriorityGroup(subcategory.category_id ? slugByCategoryId.get(subcategory.category_id) : undefined), priorityWeight: 1, rule, floorCentavos: floor, ceilingCentavos: fixed ?? Math.max(available, floor), forecastCentavos: spendBySubcategory.get(subcategory.id) ?? 0 }];
  }),
  ];
  if (!categories.length) throw new FinancialPlanInputError("Choose at least one expense category");
  const excludedSpendTransactionIds = new Set([
    ...cardPayments.flatMap((payment) => payment.transaction_id && payment.payment_date >= period.start ? [payment.transaction_id] : []),
    ...((debtPaymentsResult.data ?? []) as Array<{ transaction_id: string | null }>).flatMap((payment) => payment.transaction_id ? [payment.transaction_id] : []),
  ]);
  const spentById = monthToDateSpendById(transactions, monthToDate, categories, new Map(subcategories.map((subcategory) => [subcategory.id, subcategory.category_id])), excludedSpendTransactionIds);
  const monthToDateAddBack = (wholeMonthCategories: MlPlanCategory[]) => wholeMonthCategories.reduce((sum, category) => sum + monthToDateAddBackCentavos(category, spentById.get(category.id) ?? 0), 0);
  const minimumRequired = categories.reduce((sum, category) => sum + toRemainingPlanCategory(category, spentById.get(category.id) ?? 0, available).floorCentavos, 0);
  if (isFinancialPlanInfeasible(available, minimumRequired)) {
    const forecast = fallbackForecast(period, categories);
    const inputSnapshot = { plannedAmountCentavos, forecast, restrictions: { allocations: categories }, obligations: { reservations: [] }, debtRequirements: { reservations: [...debtReservations, ...statementReservations] }, savingsRequirements: { reservations: savingsReservations }, classification: classificationResult.data ?? { status: "unavailable" } };
    const requiredFundsCentavos = reserved + minimumRequired;
    const shortfallCentavos = Math.max(0, requiredFundsCentavos - plannedAmountCentavos);
    const explanationEvidence: FinancialPlanEvidence = { planPeriodLabel: new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: MANILA }).format(new Date(`${period.start}T00:00:00Z`)), surplusCentavos: 0, debtSurplusCentavos: 0, savingsSurplusCentavos: 0, shortfall: { plannedAmountCentavos, requiredFundsCentavos, shortfallCentavos }, seasonalPreferences, forecastChanges: [] };
    const aiExplanations = await explainFinancialPlan(explanationEvidence, fetch, userId);
    return { status: "INFEASIBLE" as const, period, inputSnapshot, recommendation: { availableFundsCentavos: available + monthToDateAddBack(categories), requiredFundsCentavos, shortfallCentavos, allocations: restoreMonthToDateSpending(categories.map((category) => toRemainingPlanCategory(category, spentById.get(category.id) ?? 0, available)).map((category) => ({ categoryId: category.target === "category" ? category.id : null, subcategoryId: category.target === "subcategory" ? category.id : null, allocationRule: category.rule, allocatedAmountCentavos: category.floorCentavos, floorAmountCentavos: category.floorCentavos, ceilingAmountCentavos: category.ceilingCentavos, forecastAmountCentavos: category.forecastCentavos })), categories, spentById), debtReservations: [...debtReservations, ...statementReservations], savingsReservations }, explanations: aiExplanations.length ? aiExplanations : fallbackFinancialPlanExplanations(explanationEvidence) };
  }
  let forecast = fallbackForecast(period, categories);
  let forecastDetails: ForecastPayload["forecasts"] = [];
  try {
    const plannedSubcategoryIds = new Set(categories.map((category) => category.id));
    const forecastTransactions = cleanTransactions.flatMap((transaction) => {
      const category = transaction.subcategory_id ? categorySlugBySubcategoryId.get(transaction.subcategory_id) : slugByCategoryId.get(transaction.category_id ?? "");
      const targetId = transaction.subcategory_id ?? (transaction.category_id && !transaction.subcategory_id ? transaction.category_id : null);
      return category && targetId && plannedSubcategoryIds.has(targetId)
        ? [{ transactionId: transaction.id, date: transaction.transaction_date, amount: transaction.amount_centavos / 100, category, transactionType: transaction.transaction_type }]
        : [];
    });
    if (forecastTransactions.length) {
      const mlForecast = await getMlForecast(userId, { historicalTransactions: forecastTransactions });
      if (forecastCoversPlanPeriod(mlForecast, period)) {
        forecast = mapPlanForecast(userId, mlForecast, categories, categorySlugBySubcategoryId);
        forecastDetails = mlForecast.forecasts;
      }
    }
  } catch (error) {
    if (!(error instanceof ForecastValidationError || error instanceof ForecastUpstreamError)) throw error;
  }
  const plannedCategories = applyFinancialPlanPriorityWeights(categories.map((category) => ({ ...category, forecastCentavos: forecast.categoryForecasts.find((point) => point.category === category.id)?.amountCentavos ?? category.floorCentavos })), new Map([...spendByCategory, ...spendBySubcategory]));
  const freshAssessment = await createFinancialConditionAssessment(userId, getServiceRoleClient());
  const assessmentRow = freshAssessment ?? (classificationResult.error ? null : classificationResult.data as { id: string; assessed_at: string; rule_set_version: string; output_snapshot: unknown } | null);
  const assessment = assessmentRow && assessmentRow.output_snapshot && typeof assessmentRow.output_snapshot === "object" && !Array.isArray(assessmentRow.output_snapshot)
    ? { id: assessmentRow.id, assessedAt: assessmentRow.assessed_at, ruleSetVersion: assessmentRow.rule_set_version, outputSnapshot: assessmentRow.output_snapshot as Record<string, unknown> }
    : null;
  const sourceUpdatedAt = latestSourceUpdate(subcategoriesResult.data ?? [], categoriesResult.data ?? [], accountsResult.data ?? [], debtsResult.data ?? [], goalsResult.data ?? [], transactionsResult.data ?? []);
  const goals = (goalsResult.data ?? []) as Goal[];
  const debts = (debtsResult.data ?? []) as Debt[];
  const eligibleEmergencyGoalId = goals.find((goal) => goal.goal_type === "emergency_fund" && goal.current_amount_centavos < goal.target_amount_centavos)?.id ?? null;
  const [strategyResult, prioritiesResult] = await Promise.all([
    supabase.from("debt_strategy_preferences").select("strategy").eq("user_id", userId).eq("deleted", false).maybeSingle(),
    supabase.from("user_debt_priorities").select("debt_account_id, priority_rank").eq("user_id", userId).eq("deleted", false).order("priority_rank").limit(100),
  ]);
  const strategy = strategyResult.data?.strategy === "snowball" ? "snowball" : "avalanche";
  const priorityIds = (prioritiesResult.data ?? []).map((priority) => priority.debt_account_id).filter((id): id is string => typeof id === "string");
  const eligibleDebtId = strategyResult.error || prioritiesResult.error ? null : selectEligibleDebt(debts, strategy, priorityIds);
  const inputSnapshot = { plannedAmountCentavos, forecast, restrictions: { allocations: plannedCategories }, obligations: { reservations: [] }, debtRequirements: { reservations: [...debtReservations, ...statementReservations] }, savingsRequirements: { reservations: savingsReservations }, classification: assessment ? { assessmentId: assessment.id, assessedAt: assessment.assessedAt, ruleSetVersion: assessment.ruleSetVersion, outputSnapshot: assessment.outputSnapshot, sourceUpdatedAt } : { status: classificationResult.error ? "unavailable" : "absent", sourceUpdatedAt } };
  const remainingPlannedCategories = plannedCategories.map((category) => toRemainingPlanCategory(category, spentById.get(category.id) ?? 0, available));
  const ml = await recommendPlanCategories(userId, period, available, remainingPlannedCategories, toRemainingForecast(forecast, spentById));
  const recommendation = ml.recommendation as { feasibility?: string; required_funds?: number; shortfall?: number; unallocated_surplus?: number; allocations?: unknown };
  const surplusCentavos = typeof recommendation.unallocated_surplus === "number" && Number.isFinite(recommendation.unallocated_surplus) && recommendation.unallocated_surplus > 0 ? Math.round(recommendation.unallocated_surplus * 100) : 0;
  const surplusRecommendation = deriveSurplusRecommendation({ unallocatedSurplusCentavos: surplusCentavos, assessment, sourceUpdatedAt, eligibleEmergencyGoalId, eligibleDebtId });
  const debtSurplusCentavos = 0;
  const savingsSurplusCentavos = 0;
  const baseDebtReservations = [...debtReservations, ...statementReservations];
  const allocations = restoreMonthToDateSpending(mapRecommendation(remainingPlannedCategories, recommendation.allocations), plannedCategories, spentById);
  const categoryLabelById = new Map([...((categoriesResult.data ?? []) as Category[]), ...subcategories].map((category) => [category.id, category.label]));
  const zeroAllocationInsights = zeroAllocationExplanations(allocations.flatMap((allocation) => {
    const targetId = allocation.categoryId ?? allocation.subcategoryId;
    const category = targetId ? plannedCategories.find((item) => item.id === targetId) : undefined;
    if (!category) return [];
    return [{ categoryName: categoryLabelById.get(category.id) ?? category.id, allocationCentavos: allocation.allocatedAmountCentavos, requiredFloorCentavos: category.floorCentavos, forecastCentavos: category.forecastCentavos }];
  }));
  const plannedInputSnapshot = { ...inputSnapshot, debtRequirements: { reservations: baseDebtReservations, surplusCentavos: debtSurplusCentavos }, savingsRequirements: { reservations: savingsReservations, surplusCentavos: savingsSurplusCentavos } };
  const categoryBySlug = new Map(((categoriesResult.data ?? []) as Category[]).map((category) => [category.slug, category]));
  const possibleSeasonalContext = seasonalPreferences.find((preference) => preference.preference === "higher_expense")?.season ?? null;
  const forecastChanges = forecastDetails.flatMap((detail) => {
    const category = categoryBySlug.get(detail.category);
    if (!category) return [];
    const allocationCentavos = allocations.reduce((sum, allocation) => {
      const targetId = allocation.categoryId ?? allocation.subcategoryId;
      return targetId && categorySlugBySubcategoryId.get(targetId) === detail.category ? sum + allocation.allocatedAmountCentavos : sum;
    }, 0);
    const differenceCentavos = detail.amountCentavos - detail.userBaselineCentavos;
    return [{ evidenceId: `forecast:${detail.category}`, categoryName: category.label, baselineCentavos: detail.userBaselineCentavos, forecastCentavos: detail.amountCentavos, allocationCentavos, allocationForecastDifferenceCentavos: allocationCentavos - detail.amountCentavos, differenceCentavos, percentageChange: detail.userBaselineCentavos > 0 ? Number((differenceCentavos / detail.userBaselineCentavos * 100).toFixed(1)) : null, forecastRationale: userFacingForecastRationale(detail.explanation), possibleSeasonalContext }];
  });
  const explanationEvidence: FinancialPlanEvidence = { planPeriodLabel: new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: MANILA }).format(new Date(`${period.start}T00:00:00Z`)), surplusCentavos, debtSurplusCentavos, savingsSurplusCentavos, seasonalPreferences, forecastChanges };
  const deterministicExplanations = fallbackFinancialPlanExplanations(explanationEvidence);
  const aiExplanations = await explainFinancialPlan(explanationEvidence, fetch, userId);
  const uniqueExplanations = [...zeroAllocationInsights, ...deterministicExplanations, ...aiExplanations, ...(Array.isArray(ml.explanations) ? ml.explanations.map((explanation) => typeof explanation === "object" && explanation !== null && "reason" in explanation ? String((explanation as { reason: unknown }).reason) : String(explanation)) : [])].filter(isUserFacingFinancialPlanExplanation).filter((explanation, index, all) => all.findIndex((item) => item.replace(/\s+/g, " ").trim().toLocaleLowerCase() === explanation.replace(/\s+/g, " ").trim().toLocaleLowerCase()) === index).slice(0, 3);
  return { status: recommendation.feasibility === "INFEASIBLE" ? "INFEASIBLE" as const : "RECOMMENDATION_READY" as const, period, inputSnapshot: plannedInputSnapshot, recommendation: { availableFundsCentavos: available + monthToDateAddBack(plannedCategories), requiredFundsCentavos: typeof recommendation.required_funds === "number" ? Math.round(recommendation.required_funds * 100) : undefined, shortfallCentavos: typeof recommendation.shortfall === "number" ? Math.round(recommendation.shortfall * 100) : undefined, allocations, debtReservations: baseDebtReservations, debtSurplusCentavos, savingsReservations, savingsSurplusCentavos, surplusRecommendation }, explanations: uniqueExplanations };
}
