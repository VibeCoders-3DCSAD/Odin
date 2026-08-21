import { calculateDebtPlan, forecastDebtFreeMonths } from "../debtLogic";

const debt = (overrides: Record<string, unknown> = {}) => ({ id: "a", balanceMinor: 1000, minimumPaymentMinor: 100, annualInterestRateBps: 0, paymentFrequency: "monthly", nextDueDate: null, targetPayoffDate: null, overdue: false, ...overrides });

test("required payments come before snowball surplus and roll over", () => {
  const result = calculateDebtPlan({ debts: [debt(), debt({ id: "b", balanceMinor: 2000, minimumPaymentMinor: 200 })], debtBudgetMinor: 1500, strategy: "snowball", priorities: [], asOfDate: "2026-08-21" });
  expect(result.requiredTotalMinor).toBe(300);
  expect(result.allocations.find((item) => item.id === "a")?.extraPaymentMinor).toBe(900);
  expect(result.allocations.find((item) => item.id === "b")?.extraPaymentMinor).toBe(300);
});

test("priorities are applied before the global strategy", () => {
  const result = calculateDebtPlan({ debts: [debt({ id: "small", balanceMinor: 500 }), debt({ id: "priority", balanceMinor: 2000 })], debtBudgetMinor: 700, strategy: "snowball", priorities: ["priority"], asOfDate: "2026-08-21" });
  expect(result.allocations.find((item) => item.id === "priority")?.extraPaymentMinor).toBe(500);
});

test("shortfall uses urgency ordering and skips strategy surplus", () => {
  const result = calculateDebtPlan({ debts: [debt({ id: "late", overdue: true, nextDueDate: "2026-09-10" }), debt({ id: "soon", nextDueDate: "2026-08-25" })], debtBudgetMinor: 100, strategy: "avalanche", priorities: ["soon"], asOfDate: "2026-08-21" });
  expect(result.shortfallMinor).toBe(100);
  expect(result.allocations.find((item) => item.id === "late")?.allocatedPaymentMinor).toBe(100);
  expect(result.allocations.every((item) => item.extraPaymentMinor === 0)).toBe(true);
});

test("frequency minimums are normalized and statuses are derived", () => {
  const result = calculateDebtPlan({ debts: [debt({ balanceMinor: 10000, minimumPaymentMinor: 100, paymentFrequency: "weekly", paidPaymentMinor: 500 }), debt({ id: "exact", paidPaymentMinor: 100, overdue: true }), debt({ id: "late", overdue: true }), debt({ id: "paid-off", balanceMinor: 0, paidPaymentMinor: 0 })], debtBudgetMinor: 0, strategy: "avalanche", priorities: [], asOfDate: "2026-08-21" });
  expect(result.allocations.find((item) => item.id === "a")?.requiredPaymentMinor).toBe(434);
  expect(result.allocations.find((item) => item.id === "a")?.status).toBe("Ahead");
  expect(result.allocations.find((item) => item.id === "exact")?.status).toBe("On Schedule");
  expect(result.allocations.find((item) => item.id === "late")?.status).toBe("Behind");
  expect(result.allocations.find((item) => item.id === "paid-off")?.status).toBe("Ahead");
});

test("principal-only forecast simulates monthly payments", () => {
  expect(forecastDebtFreeMonths([debt({ minimumPaymentMinor: 100 })], 300)).toBe(4);
  expect(forecastDebtFreeMonths([debt({ balanceMinor: 0 })], 300)).toBe(0);
  expect(forecastDebtFreeMonths([debt({ minimumPaymentMinor: 0 })], 0)).toBeNull();
});
