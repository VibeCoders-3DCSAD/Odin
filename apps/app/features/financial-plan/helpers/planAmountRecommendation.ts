import type { Category, Subcategory } from "../../../local-db/repositories/ledger/taxonomy";
import type { PlanRecommendations } from "../../../local-db/repositories/forecast/forecastTransactions";
import type { ManualPlanAllocation } from "../api";
import type { CommitmentPreview } from "./commitmentBudget";

type BudgetRule = { fixed_amount_centavos?: number | null; minimum_amount_centavos?: number | null };

export type PlanAmountRecommendation = { commitmentsCentavos: number; spendingCentavos: number; totalCentavos: number };

export type PlanAmountInput = {
  commitments: CommitmentPreview | null;
  topLevelCategories: Category[];
  subcategories: Subcategory[];
  includedCategoryIds: ReadonlySet<string>;
  includedIds: ReadonlySet<string>;
  expectedSpend: PlanRecommendations["expectedSpend"];
  manualAllocations?: ManualPlanAllocation[];
  // The plan's forecast by category slug, which caps what the plan allocates; without one, past spending.
  forecast?: Record<string, number> | null;
};

type Target = { key: string; slug: string | undefined; expectedCentavos: number };

// Mirrors the plan on the server: each category's forecast is shared by its planned targets in proportion to
// their expected spending, or evenly with none.
function forecastShares(targets: Target[], forecast: Record<string, number>): Map<string, number> {
  const bySlug = new Map<string, Target[]>();
  for (const target of targets) if (target.slug) bySlug.set(target.slug, [...(bySlug.get(target.slug) ?? []), target]);
  return new Map(targets.map((target) => {
    const group = target.slug ? bySlug.get(target.slug) ?? [] : [];
    const total = target.slug ? forecast[target.slug] ?? 0 : 0;
    const totalWeight = group.reduce((sum, item) => sum + item.expectedCentavos, 0);
    return [target.key, totalWeight > 0 ? total * target.expectedCentavos / totalWeight : group.length ? total / group.length : 0];
  }));
}

// A fixed amount is what the plan sets aside; otherwise expected spending, but never below the minimum or a one-time amount.
function targetAmount(rule: BudgetRule, expectedCentavos: number, manualCentavos: number): number {
  if (rule.fixed_amount_centavos != null) return rule.fixed_amount_centavos;
  return Math.max(rule.minimum_amount_centavos ?? 0, manualCentavos, expectedCentavos);
}

const isRequired = (rule: BudgetRule) => rule.fixed_amount_centavos != null || rule.minimum_amount_centavos != null;

/**
 * What the plan needs for the month: every savings, debt, biller and remittance at its full amount due, plus each
 * selected category's expected spending. Categories with fixed or minimum amounts count even when not selected, as
 * the plan always includes them. With a forecast, each category is expected to spend its share of the forecast, as
 * the plan allocates up to it; otherwise a category counts only spending its selected subcategories do not cover.
 */
export function recommendPlanAmount({ commitments, topLevelCategories, subcategories, includedCategoryIds, includedIds, expectedSpend, manualAllocations = [], forecast }: PlanAmountInput): PlanAmountRecommendation {
  const sum = (rows: { amountCentavos: number }[] = []) => rows.reduce((total, row) => total + row.amountCentavos, 0);
  const commitmentsCentavos = commitments ? sum(commitments.debtReservations) + sum(commitments.savingsReservations) + sum(commitments.obligations) : 0;
  const manual = new Map(manualAllocations.map((allocation) => [`${allocation.target}:${allocation.id}`, allocation.amountCentavos]));
  const plannedSubcategories = subcategories.filter((subcategory) => includedIds.has(subcategory.id) || isRequired(subcategory));
  const plannedCategories = topLevelCategories.filter((category) => includedCategoryIds.has(category.id) || isRequired(category));
  const coveredByCategory = new Map<string, number>();
  for (const subcategory of plannedSubcategories) {
    if (subcategory.category_id) coveredByCategory.set(subcategory.category_id, (coveredByCategory.get(subcategory.category_id) ?? 0) + (expectedSpend.subcategories[subcategory.id] ?? 0));
  }
  const slugByCategoryId = new Map(topLevelCategories.map((category) => [category.id, category.slug]));
  const shares = forecast ? forecastShares([
    ...plannedSubcategories.map((subcategory) => ({ key: `subcategory:${subcategory.id}`, slug: subcategory.category_id ? slugByCategoryId.get(subcategory.category_id) : undefined, expectedCentavos: expectedSpend.subcategories[subcategory.id] ?? 0 })),
    ...plannedCategories.map((category) => ({ key: `category:${category.id}`, slug: category.slug, expectedCentavos: expectedSpend.categories[category.id] ?? 0 })),
  ], forecast) : null;
  const subcategorySpending = plannedSubcategories.reduce((total, subcategory) => total + targetAmount(subcategory, shares?.get(`subcategory:${subcategory.id}`) ?? expectedSpend.subcategories[subcategory.id] ?? 0, manual.get(`subcategory:${subcategory.id}`) ?? 0), 0);
  const categorySpending = plannedCategories.reduce((total, category) => total + targetAmount(category, shares?.get(`category:${category.id}`) ?? Math.max(0, (expectedSpend.categories[category.id] ?? 0) - (coveredByCategory.get(category.id) ?? 0)), manual.get(`category:${category.id}`) ?? 0), 0);
  const spendingCentavos = Math.round(subcategorySpending + categorySpending);
  return { commitmentsCentavos, spendingCentavos, totalCentavos: commitmentsCentavos + spendingCentavos };
}
