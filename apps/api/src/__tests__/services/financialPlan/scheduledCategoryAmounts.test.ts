import { scheduledCategoryAmounts, subtractScheduledRequirements } from "../../../services/financialPlan/helpers/scheduledCategoryAmounts.js";
import { scheduledPaymentReservations, type ScheduledPaymentRow } from "../../../services/financialPlan/scheduledPaymentDates.js";
import type { MlPlanCategory } from "../../../services/financialPlan/mlAdapter.js";

const period = { start: "2026-10-01", end: "2026-10-31" };
const payment: ScheduledPaymentRow & { subcategory_id: string } = { id: "rent", subcategory_id: "rent-sub", amount_centavos: 30_000, frequency: "monthly", due_day_of_month: 15, due_second_day_of_month: null, due_day_of_week: null, due_month: null, starts_on: "2026-01-01", ends_on: null };
const parentBySubcategory = new Map([["rent-sub", "housing"], ["power-sub", "housing"]]);
const category: MlPlanCategory = { id: "housing", target: "category", priorityGroup: "ESSENTIAL", priorityWeight: 1, rule: "MINIMUM", floorCentavos: 50_000, ceilingCentavos: 200_000, forecastCentavos: 100_000 };

it("rolls multiple scheduled payments and occurrences into a selected parent, without affecting unrelated categories", () => {
  const weekly = { ...payment, id: "power", subcategory_id: "power-sub", amount_centavos: 1_000, frequency: "weekly" as const, due_day_of_week: 5 };
  const amounts = scheduledCategoryAmounts([payment, weekly], [category, { id: "food", target: "category" }], parentBySubcategory, period);
  expect(Object.fromEntries(amounts)).toEqual({ housing: 35_000 });
});

it("matches the selected subcategory once and leaves its siblings alone", () => {
  const targets = [{ id: "rent-sub", target: "subcategory" as const }, { id: "power-sub", target: "subcategory" as const }];
  expect(Object.fromEntries(scheduledCategoryAmounts([payment], targets, parentBySubcategory, period))).toEqual({ "rent-sub": 30_000 });
  expect(scheduledCategoryAmounts([payment], [{ id: "food", target: "category" }], parentBySubcategory, period).size).toBe(0);
});

it("reserves the full scheduled amount and deducts it from requirements, not the estimate", () => {
  const reservations = scheduledPaymentReservations([payment], period);
  expect(reservations.reduce((sum, row) => sum + row.amountCentavos, 0)).toBe(30_000);
  expect(subtractScheduledRequirements([category], scheduledCategoryAmounts([payment], [category], parentBySubcategory, period))[0]).toMatchObject({ forecastCentavos: 100_000, floorCentavos: 20_000 });
});

it("counts the scheduled part toward Fixed requirements and clamps requirements to zero", () => {
  const deductions = new Map([["housing", 120_000]]);
  expect(subtractScheduledRequirements([{ ...category, rule: "FIXED", ceilingCentavos: 50_000 }], deductions)[0]).toMatchObject({ floorCentavos: 0, ceilingCentavos: 0, forecastCentavos: 100_000 });
});

it("does not subtract schedules outside the plan period", () => {
  const outside = [{ ...payment, starts_on: "2026-11-01" }, { ...payment, ends_on: "2026-09-30" }];
  expect([...scheduledCategoryAmounts(outside, [category], parentBySubcategory, period).values()].reduce((sum, amount) => sum + amount, 0)).toBe(0);
});

it("keeps uncategorized scheduled payments out of category deductions", () => {
  expect(scheduledCategoryAmounts([{ ...payment, subcategory_id: null }], [category], parentBySubcategory, period).size).toBe(0);
});
