import { calculateDebtPlan, forecastDebtFreeMonths } from "../debtLogic";

test("required payments come before snowball surplus", () => {
  const result = calculateDebtPlan([
    { id: "a", balanceMinor: 1000, minimumPaymentMinor: 100, annualInterestRateBps: 0, nextDueDate: null, targetPayoffDate: null, overdue: false },
    { id: "b", balanceMinor: 2000, minimumPaymentMinor: 200, annualInterestRateBps: 0, nextDueDate: null, targetPayoffDate: null, overdue: false },
  ], 500, "snowball", [], "2026-08-21");
  expect(result.requiredTotalMinor).toBe(300);
  expect(result.surplusMinor).toBe(200);
  expect(result.allocations.find((debt) => debt.id === "a")?.extraPaymentMinor).toBe(200);
});

test("shortfall is explicit", () => {
  expect(calculateDebtPlan([{ id: "a", balanceMinor: 1000, minimumPaymentMinor: 200, annualInterestRateBps: 0, nextDueDate: null, targetPayoffDate: null, overdue: false }], 100, "avalanche", [], "2026-08-21").shortfallMinor).toBe(100);
});

test("principal-only forecast is replaceable", () => {
  expect(forecastDebtFreeMonths([{ id: "a", balanceMinor: 1000, minimumPaymentMinor: 0, annualInterestRateBps: 1000, nextDueDate: null, targetPayoffDate: null, overdue: false }], 300)).toBe(4);
});
