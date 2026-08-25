import { calculateDebtPlan, forecastDebtFreeMonths } from "../debtLogic";

const debt = (overrides: Record<string, unknown> = {}) => ({ id: "a", balanceMinor: 1000, minimumPaymentMinor: 100, annualInterestRateBps: 0, paymentFrequency: "monthly", nextDueDate: null, targetPayoffDate: null, ...overrides });

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

test("avalanche selects the highest interest debt first", () => {
  const result = calculateDebtPlan({ debts: [debt({ id: "low-rate", annualInterestRateBps: 500 }), debt({ id: "high-rate", annualInterestRateBps: 2500 })], debtBudgetMinor: 500, strategy: "avalanche", priorities: [], asOfDate: "2026-08-21" });
  expect(result.allocations.find((item) => item.id === "high-rate")?.extraPaymentMinor).toBe(300);
  expect(result.allocations.find((item) => item.id === "low-rate")?.extraPaymentMinor).toBe(0);
});

test("strategy ties use target payoff date then debt id", () => {
  const result = calculateDebtPlan({ debts: [debt({ id: "later", targetPayoffDate: "2027-02-01" }), debt({ id: "earlier", targetPayoffDate: "2026-12-01" })], debtBudgetMinor: 500, strategy: "avalanche", priorities: [], asOfDate: "2026-08-21" });
  expect(result.allocations.find((item) => item.id === "earlier")?.extraPaymentMinor).toBeGreaterThan(0);
  expect(result.allocations.find((item) => item.id === "later")?.extraPaymentMinor).toBe(0);
});

test("strategy ties use stable debt id when target dates match", () => {
  const result = calculateDebtPlan({ debts: [debt({ id: "z-debt", targetPayoffDate: "2026-12-01" }), debt({ id: "a-debt", targetPayoffDate: "2026-12-01" })], debtBudgetMinor: 700, strategy: "avalanche", priorities: [], asOfDate: "2026-08-21" });
  expect(result.allocations.find((item) => item.id === "a-debt")?.extraPaymentMinor).toBeGreaterThan(0);
  expect(result.allocations.find((item) => item.id === "z-debt")?.extraPaymentMinor).toBe(0);
});

test("surplus falls back to strategy after a priority debt is paid off", () => {
  const result = calculateDebtPlan({ debts: [debt({ id: "priority", balanceMinor: 100 }), debt({ id: "target", balanceMinor: 2000 })], debtBudgetMinor: 500, strategy: "snowball", priorities: ["priority"], asOfDate: "2026-08-21" });
  expect(result.allocations.find((item) => item.id === "priority")?.extraPaymentMinor).toBe(0);
  expect(result.allocations.find((item) => item.id === "target")?.extraPaymentMinor).toBe(300);
});

test("shortfall uses urgency ordering and skips strategy surplus", () => {
  const result = calculateDebtPlan({ debts: [debt({ id: "late", nextDueDate: "2026-08-01" }), debt({ id: "soon", nextDueDate: "2026-08-25" })], debtBudgetMinor: 100, strategy: "avalanche", priorities: ["soon"], asOfDate: "2026-08-21" });
  expect(result.shortfallMinor).toBe(100);
  expect(result.allocations.find((item) => item.id === "late")?.allocatedPaymentMinor).toBe(100);
  expect(result.allocations.every((item) => item.extraPaymentMinor === 0)).toBe(true);
});

test("frequency minimums are normalized and statuses are derived", () => {
  const result = calculateDebtPlan({ debts: [debt({ balanceMinor: 10000, minimumPaymentMinor: 100, paymentFrequency: "weekly", paidPaymentMinor: 500 }), debt({ id: "exact", paidPaymentMinor: 100, lastPaymentDate: "2026-07-01" }), debt({ id: "late", lastPaymentDate: "2026-07-01" }), debt({ id: "paid-off", balanceMinor: 0, paidPaymentMinor: 0 })], debtBudgetMinor: 0, strategy: "avalanche", priorities: [], asOfDate: "2026-08-21" });
  expect(result.allocations.find((item) => item.id === "a")?.requiredPaymentMinor).toBe(434);
  expect(result.allocations.find((item) => item.id === "a")?.status).toBe("Ahead");
  expect(result.allocations.find((item) => item.id === "exact")?.status).toBe("On Schedule");
  expect(result.allocations.find((item) => item.id === "late")?.status).toBe("Behind");
  expect(result.allocations.find((item) => item.id === "paid-off")?.status).toBe("Ahead");
});

test("debts without a due date expire after their payment frequency", () => {
  const result = calculateDebtPlan({ debts: [debt({ lastPaymentDate: "2026-07-01" })], debtBudgetMinor: 0, strategy: "avalanche", priorities: [], asOfDate: "2026-08-21" });
  expect(result.allocations[0]?.status).toBe("Behind");
});

test("forecast applies payments on their scheduled date", () => {
  expect(forecastDebtFreeMonths([
    debt({
      balanceMinor: 1200,
      minimumPaymentMinor: 1200,
      paymentFrequency: "yearly",
      paymentSchedule: { dayOfMonth: "31", monthOfYear: 12 },
    }),
  ], 1200, "avalanche", [], "2026-01-01")).toBe(12);
});

test("principal-only forecast reports calendar months to payoff", () => {
  expect(forecastDebtFreeMonths([debt({ minimumPaymentMinor: 100 })], 300, "avalanche", [], "2026-08-21")).toBe(3);
  expect(forecastDebtFreeMonths([debt({ balanceMinor: 0 })], 300)).toBe(0);
  expect(forecastDebtFreeMonths([debt({ minimumPaymentMinor: 0 })], 0)).toBeNull();
});
