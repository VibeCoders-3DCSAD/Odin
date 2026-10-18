import { scheduledPaymentDueDates, type ScheduledPaymentRow } from "../scheduledPaymentDates.js";
import type { MlExpenseForecastSnapshot, MlPlanCategory } from "../mlAdapter.js";

// Use the full month's scheduled amounts, including paid occurrences. Only the unpaid
// remainder is reserved, but neither paid nor unpaid scheduled spending belongs in category budgets.
export function scheduledCategoryAmounts(
  payments: Array<ScheduledPaymentRow & { subcategory_id: string }>,
  targets: Pick<MlPlanCategory, "id" | "target">[],
  parentBySubcategory: Map<string, string | null>,
  period: { start: string; end: string },
): Map<string, number> {
  const subcategories = new Set(targets.filter((item) => item.target === "subcategory").map((item) => item.id));
  const categories = new Set(targets.filter((item) => item.target === "category").map((item) => item.id));
  const amounts = new Map<string, number>();
  for (const payment of payments) {
    const parent = parentBySubcategory.get(payment.subcategory_id);
    const target = subcategories.has(payment.subcategory_id) ? payment.subcategory_id : parent && categories.has(parent) ? parent : null;
    if (!target) continue;
    const amount = scheduledPaymentDueDates(payment, period.start, period.end).length * payment.amount_centavos;
    amounts.set(target, (amounts.get(target) ?? 0) + amount);
  }
  return amounts;
}

export function subtractScheduledAmounts(amounts: Map<string, number>, scheduled: Map<string, number>): Map<string, number> {
  return new Map([...amounts].map(([id, amount]) => [id, Math.max(0, amount - (scheduled.get(id) ?? 0))]));
}

export function subtractScheduledRequirements(categories: MlPlanCategory[], scheduled: Map<string, number>): MlPlanCategory[] {
  return categories.map((category) => {
    const amount = scheduled.get(category.id) ?? 0;
    return { ...category, floorCentavos: Math.max(0, category.floorCentavos - amount), ceilingCentavos: Math.max(0, category.ceilingCentavos - amount), forecastCentavos: Math.max(0, category.forecastCentavos - amount) };
  });
}

export function subtractScheduledForecast(forecast: MlExpenseForecastSnapshot, scheduled: Map<string, number>, floors = new Map<string, number>()): MlExpenseForecastSnapshot {
  const categoryForecasts = forecast.categoryForecasts.map((point) => ({ ...point, amountCentavos: Math.max(floors.get(point.category) ?? 0, point.amountCentavos - (scheduled.get(point.category) ?? 0)) }));
  return { ...forecast, categoryForecasts, totalAmountCentavos: categoryForecasts.reduce((sum, point) => sum + point.amountCentavos, 0) };
}
