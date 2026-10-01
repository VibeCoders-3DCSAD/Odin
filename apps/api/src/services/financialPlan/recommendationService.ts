import type { SupabaseClient } from "@supabase/supabase-js";
import { ForecastUpstreamError, ForecastValidationError, getMlForecast, type ForecastPayload } from "../forecastService.js";
import { recommendPlanCategories, type MlExpenseForecastSnapshot, type MlPlanCategory } from "./mlAdapter.js";
import { explainFinancialPlan, fallbackFinancialPlanExplanations, type FinancialPlanEvidence } from "./explanationService.js";

const MANILA = "Asia/Manila";
const MAX_HISTORY = 500;

type Subcategory = { id: string; category_id: string | null; label: string; minimum_amount_centavos: number | null; fixed_amount_centavos: number | null; always_in_budget: boolean };
type Category = { id: string; slug: string; label: string; minimum_amount_centavos: number | null; fixed_amount_centavos: number | null };
type Debt = { id: string; current_balance_centavos: number; minimum_payment_centavos: number; next_due_date: string | null };
type Goal = { id: string; planned_contribution_amount_centavos: number | null; next_contribution_date: string | null };
type Obligation = { id: string; amount_centavos: number; due_day_of_month: number | null };
type Statement = { id: string; minimum_due_centavos: number; due_date: string };
type FinancialAccount = { kind: string; current_balance_centavos: number };
type Transaction = { id: string; amount_centavos: number; transaction_date: string; transaction_type: "income" | "expense"; category_id: string | null; subcategory_id: string | null };
type OnboardingSession = { raw_answers: Record<string, unknown> | null };
type ManualAllocation = { target: "category" | "subcategory"; id: string; amountCentavos: number };

export class FinancialPlanInputError extends Error {}
export class FinancialPlanUnavailableError extends Error {}

export function nextCalendarMonth(now = new Date()): { start: string; end: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: MANILA, year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")!.value);
  const month = Number(parts.find((part) => part.type === "month")!.value);
  return { start: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10), end: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10) };
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
    const impliedTrendMultiplier = mlDetail && mlDetail.userBaselineCentavos > 0 && mlDetail.hfceMultiplier > 0
      ? Number((mlDetail.amountCentavos / (mlDetail.userBaselineCentavos * mlDetail.hfceMultiplier)).toFixed(6))
      : null;
    // If this top-level category has no six-month spend, split its forecast evenly.
    const precedingWeight = orderedTargets.slice(0, index).reduce((sum, target) => sum + target.forecastCentavos, 0);
    const amount = totalWeight > 0
      ? Math.floor(total * (precedingWeight + category.forecastCentavos) / totalWeight) - Math.floor(total * precedingWeight / totalWeight)
      : Math.floor(total * (index + 1) / orderedTargets.length) - Math.floor(total * index / orderedTargets.length);
    console.info("financial plan forecast decision", {
      user_id: userId,
      hfce_category: slug ?? null,
      target_id: category.id,
      ml_user_baseline_centavos: mlDetail?.userBaselineCentavos ?? null,
      ml_hfce_multiplier: mlDetail?.hfceMultiplier ?? null,
      ml_implied_trend_multiplier: impliedTrendMultiplier,
      parent_forecast_centavos: total,
      target_count: orderedTargets.length,
      spend_weight_centavos: category.forecastCentavos,
      total_weight_centavos: totalWeight,
      weight_percentage: totalWeight > 0 ? Number((category.forecastCentavos / totalWeight * 100).toFixed(4)) : null,
      allocation_method: totalWeight > 0 ? "six_month_spend_weighted" : "even_split_no_spend_history",
      allocated_centavos: amount,
      floor_centavos: category.floorCentavos,
      final_forecast_centavos: Math.max(category.floorCentavos, amount),
    });
    return { category: category.id, amountCentavos: Math.max(category.floorCentavos, amount) };
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

export async function getFinancialPlanRecommendation(userId: string, supabase: SupabaseClient, plannedAmountCentavos: number, includedSubcategoryIds: string[] = [], includedCategoryIds: string[] = [], manualAllocations: ManualAllocation[] = []) {
  const period = nextCalendarMonth();
  const [subcategoriesResult, categoriesResult, accountsResult, debtsResult, goalsResult, obligationsResult, statementsResult, transactionsResult, classificationResult, onboardingResult] = await Promise.all([
    supabase.from("subcategories").select("id, category_id, label, minimum_amount_centavos, fixed_amount_centavos, always_in_budget").eq("user_id", userId).eq("kind", "expense").eq("is_active", true).eq("deleted", false).limit(200),
    supabase.from("categories").select("id, slug, label, minimum_amount_centavos, fixed_amount_centavos").eq("user_id", userId).eq("is_active", true).eq("deleted", false).limit(200),
    supabase.from("financial_accounts").select("kind, current_balance_centavos").eq("user_id", userId).eq("status", "active").eq("deleted", false).limit(100),
    supabase.from("debt_accounts").select("id, current_balance_centavos, minimum_payment_centavos, next_due_date").eq("user_id", userId).eq("status", "active").eq("deleted", false).limit(100),
    supabase.from("savings_goals").select("id, planned_contribution_amount_centavos, next_contribution_date").eq("user_id", userId).eq("status", "active").eq("deleted", false).limit(100),
    supabase.from("financial_obligations").select("id, amount_centavos, due_day_of_month").eq("user_id", userId).eq("status", "active").limit(100),
    supabase.from("credit_card_statements").select("id, minimum_due_centavos, due_date").eq("user_id", userId).eq("authoritative", true).eq("deleted", false).gte("due_date", period.start).lte("due_date", period.end).limit(100),
    supabase.from("transactions").select("id, amount_centavos, transaction_date, transaction_type, category_id, subcategory_id").eq("user_id", userId).eq("status", "posted").eq("deleted", false).order("transaction_date", { ascending: false }).limit(MAX_HISTORY),
    supabase.from("financial_condition_assessments").select("id, assessed_at, rule_set_version, output_snapshot").eq("user_id", userId).order("assessed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("onboarding_sessions").select("raw_answers").eq("user_id", userId).eq("status", "submitted").order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if ([subcategoriesResult, categoriesResult, accountsResult, debtsResult, goalsResult, obligationsResult, statementsResult, transactionsResult, classificationResult, onboardingResult].some((result) => result.error)) throw new FinancialPlanUnavailableError("Financial plan inputs are unavailable");
  const subcategories = (subcategoriesResult.data ?? []) as Subcategory[];
  if (!subcategories.length) throw new FinancialPlanInputError("No expense categories are configured");
  const availableMoney = ((accountsResult.data ?? []) as FinancialAccount[])
    .filter((account) => account.kind !== "savings" && account.kind !== "credit_card")
    .reduce((sum, account) => sum + account.current_balance_centavos, 0);
  if (availableMoney <= 0) throw new FinancialPlanInputError("No eligible financial-account balance is available");
  if (!Number.isSafeInteger(plannedAmountCentavos) || plannedAmountCentavos <= 0 || plannedAmountCentavos > availableMoney) throw new FinancialPlanInputError("Planning amount exceeds available money");
  const debtReservations = ((debtsResult.data ?? []) as Debt[]).filter((debt) => debt.current_balance_centavos > 0 && inPeriod(debt.next_due_date, period)).map((debt) => ({ debtAccountId: debt.id, creditCardStatementId: null, amountCentavos: Math.min(debt.current_balance_centavos, debt.minimum_payment_centavos), dueDate: debt.next_due_date }));
  const statementReservations = ((statementsResult.data ?? []) as Statement[]).map((statement) => ({ debtAccountId: null, creditCardStatementId: statement.id, amountCentavos: statement.minimum_due_centavos, dueDate: statement.due_date }));
  const savingsReservations = ((goalsResult.data ?? []) as Goal[]).filter((goal) => inPeriod(goal.next_contribution_date, period)).map((goal) => ({ savingsGoalId: goal.id, amountCentavos: goal.planned_contribution_amount_centavos ?? 0, dueDate: goal.next_contribution_date }));
  const obligations = ((obligationsResult.data ?? []) as Obligation[]).flatMap((obligation) => obligation.due_day_of_month ? [{ id: obligation.id, amountCentavos: obligation.amount_centavos, dueDate: `${period.start.slice(0, 8)}${String(Math.min(obligation.due_day_of_month, Number(period.end.slice(8)))).padStart(2, "0")}` }] : []);
  const reserved = [...debtReservations, ...statementReservations, ...savingsReservations, ...obligations].reduce((sum, item) => sum + item.amountCentavos, 0);
  const available = plannedAmountCentavos - reserved;
  const transactions = (transactionsResult.data ?? []) as Transaction[];
  const trailingSixMonths = new Date();
  trailingSixMonths.setUTCMonth(trailingSixMonths.getUTCMonth() - 6);
  const trailingSixMonthsStart = trailingSixMonths.toISOString().slice(0, 10);
  const spendBySubcategory = new Map<string, number>();
  const spendByCategory = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.transaction_type === "expense" && transaction.subcategory_id && transaction.transaction_date >= trailingSixMonthsStart) {
      spendBySubcategory.set(transaction.subcategory_id, (spendBySubcategory.get(transaction.subcategory_id) ?? 0) + transaction.amount_centavos);
    }
    if (transaction.transaction_type === "expense" && transaction.category_id && !transaction.subcategory_id && transaction.transaction_date >= trailingSixMonthsStart) spendByCategory.set(transaction.category_id, (spendByCategory.get(transaction.category_id) ?? 0) + transaction.amount_centavos);
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
      return [{ id: category.id, target: "category" as const, rule, floorCentavos: floor, ceilingCentavos: fixed ?? Math.max(available, floor), forecastCentavos: spendByCategory.get(category.id) ?? 0 }];
    }),
    ...subcategories.flatMap((subcategory) => {
    const fixed = subcategory.fixed_amount_centavos;
    const minimum = subcategory.minimum_amount_centavos ?? 0;
    const automaticallyIncluded = fixed !== null || subcategory.minimum_amount_centavos !== null;
    if (!automaticallyIncluded && !includedIds.has(subcategory.id)) return [];
    const rule: MlPlanCategory["rule"] = fixed !== null ? "FIXED" : (subcategory.minimum_amount_centavos !== null ? "MINIMUM" : "FLEXIBLE");
    const floor = fixed ?? Math.max(minimum, manualFloorByTarget.get(`subcategory:${subcategory.id}`) ?? 0);
    return [{ id: subcategory.id, target: "subcategory" as const, rule, floorCentavos: floor, ceilingCentavos: fixed ?? Math.max(available, floor), forecastCentavos: spendBySubcategory.get(subcategory.id) ?? 0 }];
  }),
  ];
  if (!categories.length) throw new FinancialPlanInputError("Choose at least one expense category");
  const minimumRequired = categories.reduce((sum, category) => sum + category.floorCentavos, 0);
  let forecast = fallbackForecast(period, categories);
  let forecastDetails: ForecastPayload["forecasts"] = [];
  try {
    const plannedSubcategoryIds = new Set(categories.map((category) => category.id));
    const forecastTransactions = transactions.flatMap((transaction) => {
      const category = transaction.subcategory_id ? categorySlugBySubcategoryId.get(transaction.subcategory_id) : slugByCategoryId.get(transaction.category_id ?? "");
      const targetId = transaction.subcategory_id ?? (transaction.category_id && !transaction.subcategory_id ? transaction.category_id : null);
      return category && targetId && plannedSubcategoryIds.has(targetId)
        ? [{ transactionId: transaction.id, date: transaction.transaction_date, amount: transaction.amount_centavos / 100, category, transactionType: transaction.transaction_type }]
        : [];
    });
    if (forecastTransactions.length) {
      const mlForecast = await getMlForecast(userId, { historicalTransactions: forecastTransactions });
      forecast = mapPlanForecast(userId, mlForecast, categories, categorySlugBySubcategoryId);
      forecastDetails = mlForecast.forecasts;
    }
  } catch (error) {
    if (!(error instanceof ForecastValidationError || error instanceof ForecastUpstreamError)) throw error;
  }
  const plannedCategories = categories.map((category) => ({ ...category, forecastCentavos: forecast.categoryForecasts.find((point) => point.category === category.id)?.amountCentavos ?? category.floorCentavos }));
  const inputSnapshot = { plannedAmountCentavos, forecast, restrictions: { allocations: plannedCategories }, obligations: { reservations: obligations }, debtRequirements: { reservations: [...debtReservations, ...statementReservations] }, savingsRequirements: { reservations: savingsReservations }, classification: classificationResult.data ?? { status: "unavailable" } };
  if (available <= 0 || minimumRequired > available) return { status: "INFEASIBLE" as const, period, inputSnapshot, recommendation: { availableFundsCentavos: Math.max(available, 0), requiredFundsCentavos: reserved + minimumRequired, shortfallCentavos: Math.max(0, reserved + minimumRequired - plannedAmountCentavos), allocations: plannedCategories.map((category) => ({ categoryId: category.target === "category" ? category.id : null, subcategoryId: category.target === "subcategory" ? category.id : null, allocationRule: category.rule, allocatedAmountCentavos: category.floorCentavos, floorAmountCentavos: category.floorCentavos, ceilingAmountCentavos: category.ceilingCentavos, forecastAmountCentavos: category.forecastCentavos })), debtReservations: [...debtReservations, ...statementReservations], savingsReservations }, explanations: [] };
  const ml = await recommendPlanCategories(userId, period, available, plannedCategories, forecast);
  const recommendation = ml.recommendation as { feasibility?: string; required_funds?: number; shortfall?: number; unallocated_surplus?: number; allocations?: unknown };
  const surplusCentavos = typeof recommendation.unallocated_surplus === "number" && Number.isFinite(recommendation.unallocated_surplus) && recommendation.unallocated_surplus > 0 ? Math.round(recommendation.unallocated_surplus * 100) : 0;
  const debtSurplusCentavos = Math.floor(surplusCentavos / 2);
  const savingsSurplusCentavos = surplusCentavos - debtSurplusCentavos;
  const baseDebtReservations = [...debtReservations, ...statementReservations];
  const plannedInputSnapshot = { ...inputSnapshot, debtRequirements: { reservations: baseDebtReservations, surplusCentavos: debtSurplusCentavos }, savingsRequirements: { reservations: savingsReservations, surplusCentavos: savingsSurplusCentavos } };
  const answers = ((onboardingResult.data as OnboardingSession | null)?.raw_answers ?? {});
  const seasonalLabels: Record<string, string> = { rainy_season: "Rainy Season", back_to_school: "Back-to-School Season", undas: "Undas / All Souls' Day", christmas_ber_months: "Christmas and Ber Months", new_year: "New Year", summer: "Summer", annual_payments: "Tax and Annual-Payment Season", family_celebrations: "Birthday and Family-Celebration Months" };
  const seasonalPreferences = ["saving_seasons", "high_expense_seasons"].flatMap((key) => Array.isArray(answers[key]) ? answers[key].flatMap((value) => typeof value === "string" && seasonalLabels[value] ? [{ evidenceId: `${key}:${value}`, season: seasonalLabels[value], preference: key === "saving_seasons" ? "saving" as const : "higher_expense" as const }] : []) : []);
  const categoryLabelById = new Map([...((categoriesResult.data ?? []) as Category[]), ...subcategories].map((category) => [category.id, category.label]));
  const forecastChanges = forecastDetails.flatMap((detail) => {
    const target = plannedCategories.find((category) => categorySlugBySubcategoryId.get(category.id) === detail.category);
    if (!target) return [];
    return [{ evidenceId: `forecast:${target.id}`, categoryName: categoryLabelById.get(target.id) ?? detail.category, baselineCentavos: detail.userBaselineCentavos, forecastCentavos: detail.amountCentavos, differenceCentavos: detail.amountCentavos - detail.userBaselineCentavos }];
  });
  const explanationEvidence: FinancialPlanEvidence = { planPeriodLabel: new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: MANILA }).format(new Date(`${period.start}T00:00:00Z`)), surplusCentavos, debtSurplusCentavos, savingsSurplusCentavos, seasonalPreferences, forecastChanges };
  const deterministicExplanations = fallbackFinancialPlanExplanations(explanationEvidence);
  const aiExplanations = await explainFinancialPlan(explanationEvidence);
  return { status: recommendation.feasibility === "INFEASIBLE" ? "INFEASIBLE" as const : "RECOMMENDATION_READY" as const, period, inputSnapshot: plannedInputSnapshot, recommendation: { availableFundsCentavos: available, requiredFundsCentavos: typeof recommendation.required_funds === "number" ? Math.round(recommendation.required_funds * 100) : undefined, shortfallCentavos: typeof recommendation.shortfall === "number" ? Math.round(recommendation.shortfall * 100) : undefined, allocations: mapRecommendation(plannedCategories, recommendation.allocations), debtReservations: baseDebtReservations, debtSurplusCentavos, savingsReservations, savingsSurplusCentavos }, explanations: aiExplanations.length ? aiExplanations : [...deterministicExplanations, ...(Array.isArray(ml.explanations) ? ml.explanations.map((explanation) => typeof explanation === "object" && explanation !== null && "reason" in explanation ? String((explanation as { reason: unknown }).reason) : String(explanation)) : [])] };
}
