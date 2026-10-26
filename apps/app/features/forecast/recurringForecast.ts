import { recurringMonthSpend } from "@odin/spending-insights/recurringMonths";
import type { RecurringForecastPayment } from "../../local-db/repositories/forecastTransactions";
import type { QuarterlyForecastPayload } from "./types";

type CategoryAmount = { category: string; amountCentavos: number };
type Period = { totalCentavos: number; categories: CategoryAmount[] };

function quarterMonths(quarter: string): string[] {
  const firstMonth = (Number(quarter.slice(5)) - 1) * 3 + 1;
  return [0, 1, 2].map((offset) => `${quarter.slice(0, 4)}-${String(firstMonth + offset).padStart(2, "0")}`);
}

function withRecurring<T extends Period>(period: T, months: string[], payments: RecurringForecastPayment[]): T {
  const added = new Map<string, number>();
  for (const category of new Set(payments.map((payment) => payment.category))) {
    const inCategory = payments.filter((payment) => payment.category === category);
    const amountCentavos = months.reduce((sum, month) => sum + recurringMonthSpend(inCategory, month), 0);
    if (amountCentavos > 0) added.set(category, amountCentavos);
  }
  if (added.size === 0) return period;
  const categories = period.categories.map((item) => added.has(item.category) ? { ...item, amountCentavos: item.amountCentavos + added.get(item.category)! } : item);
  const missing = [...added].filter(([category]) => !period.categories.some((item) => item.category === category));
  const total = [...added.values()].reduce((sum, amount) => sum + amount, 0);
  return { ...period, totalCentavos: period.totalCentavos + total, categories: [...categories, ...missing.map(([category, amountCentavos]) => ({ category, amountCentavos }))] };
}

// Unusual payments the user said come back in certain months, such as tuition, stay out of the history the
// forecast learns from; each month and quarter adds them back at their amount in the months they recur.
export function addRecurringPayments(forecast: QuarterlyForecastPayload, payments: RecurringForecastPayment[]): QuarterlyForecastPayload {
  if (payments.length === 0) return forecast;
  return {
    ...forecast,
    quarters: forecast.quarters.map((quarter) => withRecurring(quarter, quarterMonths(quarter.quarter), payments)),
    ...(forecast.months ? { months: forecast.months.map((month) => withRecurring(month, [month.month], payments)) } : {}),
  };
}
