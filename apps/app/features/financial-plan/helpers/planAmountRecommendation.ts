import type { Category, Subcategory } from "../../../local-db/repositories/taxonomy";
import type { PlanRecommendations } from "../../../local-db/repositories/forecastTransactions";
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
};

// A fixed amount is what the plan sets aside; otherwise expected spending, but never below the minimum or a one-time amount.
function targetAmount(rule: BudgetRule, expectedCentavos: number, manualCentavos: number): number {
  if (rule.fixed_amount_centavos != null) return rule.fixed_amount_centavos;
  return Math.max(rule.minimum_amount_centavos ?? 0, manualCentavos, expectedCentavos);
}

const isRequired = (rule: BudgetRule) => rule.fixed_amount_centavos != null || rule.minimum_amount_centavos != null;

/**
 * What the plan needs for the month: every savings, debt, biller and remittance at its full amount due, plus each
 * selected category's expected spending. Categories with fixed or minimum amounts count even when not selected, as
 * the plan always includes them. A category counts only spending its selected subcategories do not already cover.
 */
export function recommendPlanAmount({ commitments, topLevelCategories, subcategories, includedCategoryIds, includedIds, expectedSpend, manualAllocations = [] }: PlanAmountInput): PlanAmountRecommendation {
  const sum = (rows: { amountCentavos: number }[] = []) => rows.reduce((total, row) => total + row.amountCentavos, 0);
  const commitmentsCentavos = commitments ? sum(commitments.debtReservations) + sum(commitments.savingsReservations) + sum(commitments.obligations) : 0;
  const manual = new Map(manualAllocations.map((allocation) => [`${allocation.target}:${allocation.id}`, allocation.amountCentavos]));
  const plannedSubcategories = subcategories.filter((subcategory) => includedIds.has(subcategory.id) || isRequired(subcategory));
  const coveredByCategory = new Map<string, number>();
  for (const subcategory of plannedSubcategories) {
    if (subcategory.category_id) coveredByCategory.set(subcategory.category_id, (coveredByCategory.get(subcategory.category_id) ?? 0) + (expectedSpend.subcategories[subcategory.id] ?? 0));
  }
  const subcategorySpending = plannedSubcategories.reduce((total, subcategory) => total + targetAmount(subcategory, expectedSpend.subcategories[subcategory.id] ?? 0, manual.get(`subcategory:${subcategory.id}`) ?? 0), 0);
  const categorySpending = topLevelCategories
    .filter((category) => includedCategoryIds.has(category.id) || isRequired(category))
    .reduce((total, category) => total + targetAmount(category, Math.max(0, (expectedSpend.categories[category.id] ?? 0) - (coveredByCategory.get(category.id) ?? 0)), manual.get(`category:${category.id}`) ?? 0), 0);
  const spendingCentavos = Math.round(subcategorySpending + categorySpending);
  return { commitmentsCentavos, spendingCentavos, totalCentavos: commitmentsCentavos + spendingCentavos };
}
