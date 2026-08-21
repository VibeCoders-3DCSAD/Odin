export type DebtStrategy = "snowball" | "avalanche";
export type DebtLogicInput = {
  id: string; balanceMinor: number; minimumPaymentMinor: number; annualInterestRateBps: number;
  nextDueDate: string | null; targetPayoffDate: string | null; overdue: boolean;
};
export type DebtAllocation = DebtLogicInput & { requiredPaymentMinor: number; extraPaymentMinor: number; status: "Ahead" | "On Schedule" | "Behind" };

function monthsRemaining(debt: DebtLogicInput, asOfDate: string): number {
  if (!debt.targetPayoffDate) return Math.max(1, Math.ceil(debt.balanceMinor / Math.max(debt.minimumPaymentMinor, 1)));
  const start = new Date(`${asOfDate}T00:00:00Z`);
  const end = new Date(`${debt.targetPayoffDate}T00:00:00Z`);
  return Math.max(1, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth());
}

export function calculateDebtPlan(debts: DebtLogicInput[], debtBudgetMinor: number, strategy: DebtStrategy, priorities: string[], asOfDate: string) {
  const active = debts.filter((debt) => debt.balanceMinor > 0);
  const required = active.map((debt) => ({ ...debt, requiredPaymentMinor: Math.min(debt.balanceMinor, Math.max(Math.ceil(debt.balanceMinor / monthsRemaining(debt, asOfDate)), debt.minimumPaymentMinor)) }));
  const requiredTotalMinor = required.reduce((sum, debt) => sum + debt.requiredPaymentMinor, 0);
  const shortfallMinor = Math.max(requiredTotalMinor - debtBudgetMinor, 0);
  let available = Math.max(debtBudgetMinor - requiredTotalMinor, 0);
  const priorityIndex = new Map(priorities.map((id, index) => [id, index]));
  const ordered = [...required].sort((a, b) => {
    const ap = priorityIndex.get(a.id); const bp = priorityIndex.get(b.id);
    if (ap !== undefined || bp !== undefined) return (ap ?? Number.MAX_SAFE_INTEGER) - (bp ?? Number.MAX_SAFE_INTEGER);
    const value = strategy === "snowball" ? a.balanceMinor - b.balanceMinor : b.annualInterestRateBps - a.annualInterestRateBps;
    return value || (a.targetPayoffDate ?? "").localeCompare(b.targetPayoffDate ?? "") || a.id.localeCompare(b.id);
  });
  const allocations: DebtAllocation[] = required.map((debt) => ({ ...debt, extraPaymentMinor: 0, status: debt.balanceMinor === 0 ? "Ahead" : debt.overdue && debt.requiredPaymentMinor > debtBudgetMinor ? "Behind" : "On Schedule" }));
  for (const debt of ordered) {
    if (!available) break;
    const allocation = allocations.find((item) => item.id === debt.id)!;
    const extra = Math.min(debt.balanceMinor - debt.requiredPaymentMinor, available);
    allocation.extraPaymentMinor = Math.max(0, extra);
    available -= allocation.extraPaymentMinor;
  }
  return { allocations, requiredTotalMinor, surplusMinor: Math.max(debtBudgetMinor - requiredTotalMinor, 0), shortfallMinor };
}

export function forecastDebtFreeMonths(debts: DebtLogicInput[], monthlyPaymentMinor: number): number | null {
  let balance = debts.reduce((sum, debt) => sum + debt.balanceMinor, 0);
  if (balance <= 0) return 0;
  if (monthlyPaymentMinor <= 0) return null;
  return Math.ceil(balance / monthlyPaymentMinor);
}
