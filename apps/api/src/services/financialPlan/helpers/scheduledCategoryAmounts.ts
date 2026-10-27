import { scheduledPaymentDueDates, type ScheduledPaymentRow } from "../scheduledPaymentDates.js";
import type { MlPlanCategory } from "../mlAdapter.js";

// Use the full month's scheduled amounts, including paid occurrences. Only the unpaid
// remainder is reserved, but neither paid nor unpaid scheduled spending belongs in category budgets.
export function scheduledCategoryAmounts(
  payments: Array<ScheduledPaymentRow & { subcategory_id: string | null }>,
  targets: Pick<MlPlanCategory, "id" | "target">[],
  parentBySubcategory: Map<string, string | null>,
  period: { start: string; end: string },
): Map<string, number> {
  const subcategories = new Set(targets.filter((item) => item.target === "subcategory").map((item) => item.id));
  const categories = new Set(targets.filter((item) => item.target === "category").map((item) => item.id));
  const amounts = new Map<string, number>();
  for (const payment of payments) {
    if (!payment.subcategory_id) continue;
    const parent = parentBySubcategory.get(payment.subcategory_id);
    const target = subcategories.has(payment.subcategory_id) ? payment.subcategory_id : parent && categories.has(parent) ? parent : null;
    if (!target) continue;
    const amount = scheduledPaymentDueDates(payment, period.start, period.end).length * payment.amount_centavos;
    amounts.set(target, (amounts.get(target) ?? 0) + amount);
  }
  return amounts;
}

export function subtractScheduledRequirements(categories: MlPlanCategory[], scheduled: Map<string, number>): MlPlanCategory[] {
  return categories.map((category) => {
    const amount = scheduled.get(category.id) ?? 0;
    // The estimate already leaves scheduled payments out of its history; only the requirements include them.
    return { ...category, floorCentavos: Math.max(0, category.floorCentavos - amount), ceilingCentavos: Math.max(0, category.ceilingCentavos - amount) };
  });
}
