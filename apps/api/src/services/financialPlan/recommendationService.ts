import type { SupabaseClient } from "@supabase/supabase-js";
import { ForecastUpstreamError, ForecastValidationError, getMlForecast, type ForecastPayload } from "../forecastService.js";
import { recommendPlanCategories, type MlExpenseForecastSnapshot, type MlPlanCategory } from "./mlAdapter.js";

const MANILA = "Asia/Manila";
const MAX_HISTORY = 500;

type Subcategory = { id: string; category_id: string | null; minimum_amount_centavos: number | null; fixed_amount_centavos: number | null; always_in_budget: boolean };
type Category = { id: string; slug: string };
type Debt = { id: string; current_balance_centavos: number; minimum_payment_centavos: number; next_due_date: string | null };
type Goal = { id: string; planned_contribution_amount_centavos: number | null; next_contribution_date: string | null };
type Obligation = { id: string; amount_centavos: number; due_day_of_month: number | null };
type Statement = { id: string; minimum_due_centavos: number; due_date: string };
type Income = { expected_amount_centavos: number | null; frequency: string };
type Transaction = { id: string; amount_centavos: number; transaction_date: string; transaction_type: "income" | "expense"; subcategory_id: string | null };

export class FinancialPlanInputError extends Error {}
export class FinancialPlanUnavailableError extends Error {}

export function nextCalendarMonth(now = new Date()): { start: string; end: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: MANILA, year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")!.value);
  const month = Number(parts.find((part) => part.type === "month")!.value);
  return { start: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10), end: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10) };
}

function monthlyAmount(amount: number, frequency: string): number {
  if (frequency === "weekly") return Math.round(amount * 52 / 12);
  if (frequency === "biweekly") return Math.round(amount * 26 / 12);
  if (frequency === "semi_monthly") return amount * 2;
  if (frequency === "quarterly") return Math.round(amount / 3);
  if (frequency === "yearly") return Math.round(amount / 12);
  return amount;
}

function inPeriod(date: string | null, period: { start: string; end: string }): date is string {
  return date !== null && date >= period.start && date <= period.end;
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
    // If this top-level category has no six-month spend, split its forecast evenly.
    const precedingWeight = orderedTargets.slice(0, index).reduce((sum, target) => sum + target.forecastCentavos, 0);
    const amount = totalWeight > 0
      ? Math.floor(total * (precedingWeight + category.forecastCentavos) / totalWeight) - Math.floor(total * precedingWeight / totalWeight)
      : Math.floor(total * (index + 1) / orderedTargets.length) - Math.floor(total * index / orderedTargets.length);
    return { category: category.id, amountCentavos: Math.max(category.floorCentavos, amount) };
  });
  return { month: mlForecast.snapshot.month, totalAmountCentavos: categoryForecasts.reduce((sum, point) => sum + point.amountCentavos, 0), categoryForecasts, modelVersion: mlForecast.snapshot.modelVersion, generatedAt: mlForecast.snapshot.generatedAt, quality: mlForecast.snapshot.quality };
}

function mapRecommendation(categories: MlPlanCategory[], allocationAmounts: unknown): Array<{ subcategoryId: string; allocationRule: MlPlanCategory["rule"]; allocatedAmountCentavos: number; floorAmountCentavos: number; ceilingAmountCentavos: number; forecastAmountCentavos: number }> {
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
    return { subcategoryId: category.id, allocationRule: category.rule, allocatedAmountCentavos: amount, floorAmountCentavos: category.floorCentavos, ceilingAmountCentavos: category.ceilingCentavos, forecastAmountCentavos: category.forecastCentavos };
  });
}

export async function getFinancialPlanRecommendation(userId: string, supabase: SupabaseClient, includedSubcategoryIds: string[] = []) {
  const period = nextCalendarMonth();
  const [subcategoriesResult, categoriesResult, incomeResult, debtsResult, goalsResult, obligationsResult, statementsResult, transactionsResult, classificationResult] = await Promise.all([
    supabase.from("subcategories").select("id, category_id, minimum_amount_centavos, fixed_amount_centavos, always_in_budget").eq("user_id", userId).eq("kind", "expense").eq("is_active", true).eq("deleted", false).limit(200),
    supabase.from("categories").select("id, slug").eq("user_id", userId).eq("is_active", true).eq("deleted", false).limit(200),
    supabase.from("income_sources").select("expected_amount_centavos, frequency").eq("user_id", userId).eq("is_active", true).eq("deleted", false).limit(100),
    supabase.from("debt_accounts").select("id, current_balance_centavos, minimum_payment_centavos, next_due_date").eq("user_id", userId).eq("status", "active").eq("deleted", false).limit(100),
    supabase.from("savings_goals").select("id, planned_contribution_amount_centavos, next_contribution_date").eq("user_id", userId).eq("status", "active").eq("deleted", false).limit(100),
    supabase.from("financial_obligations").select("id, amount_centavos, due_day_of_month").eq("user_id", userId).eq("status", "active").limit(100),
    supabase.from("credit_card_statements").select("id, minimum_due_centavos, due_date").eq("user_id", userId).eq("authoritative", true).eq("deleted", false).gte("due_date", period.start).lte("due_date", period.end).limit(100),
    supabase.from("transactions").select("id, amount_centavos, transaction_date, transaction_type, subcategory_id").eq("user_id", userId).eq("status", "posted").eq("deleted", false).order("transaction_date", { ascending: false }).limit(MAX_HISTORY),
    supabase.from("financial_condition_assessments").select("id, assessed_at, rule_set_version, output_snapshot").eq("user_id", userId).order("assessed_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if ([subcategoriesResult, categoriesResult, incomeResult, debtsResult, goalsResult, obligationsResult, statementsResult, transactionsResult, classificationResult].some((result) => result.error)) throw new FinancialPlanUnavailableError("Financial plan inputs are unavailable");
  const subcategories = (subcategoriesResult.data ?? []) as Subcategory[];
  if (!subcategories.length) throw new FinancialPlanInputError("No expense categories are configured");
  const income = ((incomeResult.data ?? []) as Income[]).reduce((sum, source) => sum + monthlyAmount(source.expected_amount_centavos ?? 0, source.frequency), 0);
  if (income <= 0) throw new FinancialPlanInputError("No monthly income is configured");
  const debtReservations = ((debtsResult.data ?? []) as Debt[]).filter((debt) => debt.current_balance_centavos > 0 && inPeriod(debt.next_due_date, period)).map((debt) => ({ debtAccountId: debt.id, creditCardStatementId: null, amountCentavos: Math.min(debt.current_balance_centavos, debt.minimum_payment_centavos), dueDate: debt.next_due_date }));
  const statementReservations = ((statementsResult.data ?? []) as Statement[]).map((statement) => ({ debtAccountId: null, creditCardStatementId: statement.id, amountCentavos: statement.minimum_due_centavos, dueDate: statement.due_date }));
  const savingsReservations = ((goalsResult.data ?? []) as Goal[]).filter((goal) => inPeriod(goal.next_contribution_date, period)).map((goal) => ({ savingsGoalId: goal.id, amountCentavos: goal.planned_contribution_amount_centavos ?? 0, dueDate: goal.next_contribution_date }));
  const obligations = ((obligationsResult.data ?? []) as Obligation[]).flatMap((obligation) => obligation.due_day_of_month ? [{ id: obligation.id, amountCentavos: obligation.amount_centavos, dueDate: `${period.start.slice(0, 8)}${String(Math.min(obligation.due_day_of_month, Number(period.end.slice(8)))).padStart(2, "0")}` }] : []);
  const reserved = [...debtReservations, ...statementReservations, ...savingsReservations, ...obligations].reduce((sum, item) => sum + item.amountCentavos, 0);
  const available = income - reserved;
  const transactions = (transactionsResult.data ?? []) as Transaction[];
  const trailingSixMonths = new Date();
  trailingSixMonths.setUTCMonth(trailingSixMonths.getUTCMonth() - 6);
  const trailingSixMonthsStart = trailingSixMonths.toISOString().slice(0, 10);
  const spendBySubcategory = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.transaction_type === "expense" && transaction.subcategory_id && transaction.transaction_date >= trailingSixMonthsStart) {
      spendBySubcategory.set(transaction.subcategory_id, (spendBySubcategory.get(transaction.subcategory_id) ?? 0) + transaction.amount_centavos);
    }
  }
  const slugByCategoryId = new Map(((categoriesResult.data ?? []) as Category[]).map((category) => [category.id, category.slug]));
  const categorySlugBySubcategoryId = new Map(subcategories.map((subcategory) => [subcategory.id, subcategory.category_id ? slugByCategoryId.get(subcategory.category_id) : undefined]));
  const includedIds = new Set(includedSubcategoryIds);
  const categories: MlPlanCategory[] = subcategories.flatMap((subcategory) => {
    const fixed = subcategory.fixed_amount_centavos;
    const minimum = subcategory.minimum_amount_centavos ?? 0;
    const automaticallyIncluded = fixed !== null && fixed > 0 || minimum > 0;
    if (!automaticallyIncluded && !includedIds.has(subcategory.id)) return [];
    const rule = fixed !== null ? "FIXED" : (minimum > 0 ? "MINIMUM" : "FLEXIBLE");
    const floor = fixed ?? minimum;
    return [{ id: subcategory.id, rule, floorCentavos: floor, ceilingCentavos: fixed ?? Math.max(available, floor), forecastCentavos: spendBySubcategory.get(subcategory.id) ?? 0 }];
  });
  if (!categories.length) throw new FinancialPlanInputError("Choose at least one expense category");
  const minimumRequired = categories.reduce((sum, category) => sum + category.floorCentavos, 0);
  let forecast = fallbackForecast(period, categories);
  try {
    const plannedSubcategoryIds = new Set(categories.map((category) => category.id));
    const forecastTransactions = transactions.flatMap((transaction) => {
      const category = transaction.subcategory_id ? categorySlugBySubcategoryId.get(transaction.subcategory_id) : undefined;
      return category && transaction.subcategory_id && plannedSubcategoryIds.has(transaction.subcategory_id)
        ? [{ transactionId: transaction.id, date: transaction.transaction_date, amount: transaction.amount_centavos / 100, category, transactionType: transaction.transaction_type }]
        : [];
    });
    if (forecastTransactions.length) forecast = mapPlanForecast(await getMlForecast(userId, { historicalTransactions: forecastTransactions }), categories, categorySlugBySubcategoryId);
  } catch (error) {
    if (!(error instanceof ForecastValidationError || error instanceof ForecastUpstreamError)) throw error;
  }
  const plannedCategories = categories.map((category) => ({ ...category, forecastCentavos: forecast.categoryForecasts.find((point) => point.category === category.id)?.amountCentavos ?? category.floorCentavos }));
  const inputSnapshot = { forecast, restrictions: { allocations: plannedCategories }, obligations: { reservations: obligations }, debtRequirements: { reservations: [...debtReservations, ...statementReservations] }, savingsRequirements: { reservations: savingsReservations }, classification: classificationResult.data ?? { status: "unavailable" } };
  if (available <= 0 || minimumRequired > available) return { status: "INFEASIBLE" as const, period, inputSnapshot, recommendation: { availableFundsCentavos: Math.max(available, 0), requiredFundsCentavos: reserved + minimumRequired, shortfallCentavos: Math.max(0, reserved + minimumRequired - income), allocations: plannedCategories.map((category) => ({ subcategoryId: category.id, allocationRule: category.rule, allocatedAmountCentavos: category.floorCentavos, floorAmountCentavos: category.floorCentavos, ceilingAmountCentavos: category.ceilingCentavos, forecastAmountCentavos: category.forecastCentavos })), debtReservations: [...debtReservations, ...statementReservations], savingsReservations }, explanations: [] };
  const ml = await recommendPlanCategories(userId, period, available, plannedCategories, forecast);
  const recommendation = ml.recommendation as { feasibility?: string; required_funds?: number; shortfall?: number; unallocated_surplus?: number; allocations?: unknown };
  const surplusCentavos = typeof recommendation.unallocated_surplus === "number" && Number.isFinite(recommendation.unallocated_surplus) && recommendation.unallocated_surplus > 0 ? Math.round(recommendation.unallocated_surplus * 100) : 0;
  const debtSurplusCentavos = Math.floor(surplusCentavos / 2);
  const savingsSurplusCentavos = surplusCentavos - debtSurplusCentavos;
  const baseDebtReservations = [...debtReservations, ...statementReservations];
  const plannedInputSnapshot = { ...inputSnapshot, debtRequirements: { reservations: baseDebtReservations, surplusCentavos: debtSurplusCentavos }, savingsRequirements: { reservations: savingsReservations, surplusCentavos: savingsSurplusCentavos } };
  const surplusExplanation = surplusCentavos > 0 ? [`Forecast surplus: ${(debtSurplusCentavos / 100).toFixed(2)} reserved for debt and ${(savingsSurplusCentavos / 100).toFixed(2)} reserved for savings.`] : [];
  return { status: recommendation.feasibility === "INFEASIBLE" ? "INFEASIBLE" as const : "RECOMMENDATION_READY" as const, period, inputSnapshot: plannedInputSnapshot, recommendation: { availableFundsCentavos: available, requiredFundsCentavos: typeof recommendation.required_funds === "number" ? Math.round(recommendation.required_funds * 100) : undefined, shortfallCentavos: typeof recommendation.shortfall === "number" ? Math.round(recommendation.shortfall * 100) : undefined, allocations: mapRecommendation(plannedCategories, recommendation.allocations), debtReservations: baseDebtReservations, debtSurplusCentavos, savingsReservations, savingsSurplusCentavos }, explanations: [...surplusExplanation, ...(Array.isArray(ml.explanations) ? ml.explanations.map((explanation) => typeof explanation === "object" && explanation !== null && "reason" in explanation ? String((explanation as { reason: unknown }).reason) : String(explanation)) : [])] };
}
