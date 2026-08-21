export type DebtStrategy = "snowball" | "avalanche";
export type DebtLogicInput = {
  id: string;
  balanceMinor: number;
  minimumPaymentMinor: number;
  annualInterestRateBps: number;
  paymentFrequency?: string;
  nextDueDate: string | null;
  targetPayoffDate: string | null;
  paidPaymentMinor?: number;
  overdue: boolean;
};
export type DebtPlanInput = {
  debts: DebtLogicInput[];
  debtBudgetMinor: number;
  strategy: DebtStrategy;
  priorities: string[];
  asOfDate: string;
};
export type DebtAllocation = DebtLogicInput & {
  requiredPaymentMinor: number;
  allocatedPaymentMinor: number;
  extraPaymentMinor: number;
  status: "Ahead" | "On Schedule" | "Behind";
};

function monthsRemaining(debt: DebtLogicInput, asOfDate: string): number {
  if (!debt.targetPayoffDate) return Math.max(1, Math.ceil(debt.balanceMinor / Math.max(debt.minimumPaymentMinor, 1)));
  const start = new Date(`${asOfDate}T00:00:00Z`);
  const end = new Date(`${debt.targetPayoffDate}T00:00:00Z`);
  return Math.max(1, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth());
}

function monthlyMinimum(debt: DebtLogicInput): number {
  const multiplier = { daily: 365 / 12, weekly: 52 / 12, biweekly: 26 / 12, semi_monthly: 2, quarterly: 1 / 3, yearly: 1 / 12 }[debt.paymentFrequency ?? "monthly"] ?? 1;
  return Math.ceil(debt.minimumPaymentMinor * multiplier);
}

function urgencyCompare(a: DebtAllocation, b: DebtAllocation): number {
  return Number(b.overdue) - Number(a.overdue)
    || (a.nextDueDate ?? "9999-12-31").localeCompare(b.nextDueDate ?? "9999-12-31")
    || (a.targetPayoffDate ?? "9999-12-31").localeCompare(b.targetPayoffDate ?? "9999-12-31")
    || a.id.localeCompare(b.id);
}

function strategyCompare(strategy: DebtStrategy, priorities: Map<string, number>) {
  return (a: DebtAllocation, b: DebtAllocation): number => {
    const priorityA = priorities.get(a.id); const priorityB = priorities.get(b.id);
    if (priorityA !== undefined || priorityB !== undefined) return (priorityA ?? Number.MAX_SAFE_INTEGER) - (priorityB ?? Number.MAX_SAFE_INTEGER);
    const value = strategy === "snowball" ? a.balanceMinor - b.balanceMinor : b.annualInterestRateBps - a.annualInterestRateBps;
    return value || (a.targetPayoffDate ?? "9999-12-31").localeCompare(b.targetPayoffDate ?? "9999-12-31") || a.id.localeCompare(b.id);
  };
}

export function calculateDebtPlan(input: DebtPlanInput) {
  const allocations: DebtAllocation[] = input.debts.map((debt) => {
    const requiredPaymentMinor = Math.min(debt.balanceMinor, Math.max(Math.ceil(debt.balanceMinor / monthsRemaining(debt, input.asOfDate)), monthlyMinimum(debt)));
    const paid = debt.paidPaymentMinor ?? 0;
    const status = debt.balanceMinor <= 0 ? "Ahead" : paid > requiredPaymentMinor ? "Ahead" : paid >= requiredPaymentMinor || !debt.overdue ? "On Schedule" : "Behind";
    return { ...debt, requiredPaymentMinor, allocatedPaymentMinor: 0, extraPaymentMinor: 0, status };
  });
  const requiredTotalMinor = allocations.reduce((sum, debt) => sum + debt.requiredPaymentMinor, 0);
  const shortfallMinor = Math.max(requiredTotalMinor - input.debtBudgetMinor, 0);
  let available = Math.max(input.debtBudgetMinor - requiredTotalMinor, 0);

  if (shortfallMinor > 0) {
    available = input.debtBudgetMinor;
    for (const debt of [...allocations].sort(urgencyCompare)) {
      debt.allocatedPaymentMinor = Math.min(debt.requiredPaymentMinor, available);
      available -= debt.allocatedPaymentMinor;
      if (!available) break;
    }
  } else {
    for (const debt of allocations) debt.allocatedPaymentMinor = debt.requiredPaymentMinor;
    for (const debt of allocations.filter((item) => item.balanceMinor > 0).sort(strategyCompare(input.strategy, new Map(input.priorities.map((id, index) => [id, index]))))) {
      if (!available) break;
      const extra = Math.min(debt.balanceMinor - debt.requiredPaymentMinor, available);
      debt.extraPaymentMinor = Math.max(0, extra);
      debt.allocatedPaymentMinor += debt.extraPaymentMinor;
      available -= debt.extraPaymentMinor;
    }
  }
  return { allocations, requiredTotalMinor, surplusMinor: Math.max(input.debtBudgetMinor - requiredTotalMinor, 0), shortfallMinor };
}

export function forecastDebtFreeMonths(debts: DebtLogicInput[], monthlyPaymentMinor: number, strategy: DebtStrategy = "avalanche", priorities: string[] = []): number | null {
  if (monthlyPaymentMinor <= 0) return debts.some((debt) => debt.balanceMinor > 0) ? null : 0;
  const balances = debts.filter((debt) => debt.balanceMinor > 0).map((debt) => ({ ...debt, balanceMinor: debt.balanceMinor }));
  let months = 0;
  while (balances.some((debt) => debt.balanceMinor > 0) && months < 1200) {
    const plan = calculateDebtPlan({ debts: balances, debtBudgetMinor: monthlyPaymentMinor, strategy, priorities, asOfDate: "9999-01-01" });
    for (const allocation of plan.allocations) {
      const debt = balances.find((item) => item.id === allocation.id)!;
      debt.balanceMinor -= Math.min(debt.balanceMinor, allocation.allocatedPaymentMinor);
    }
    months++;
  }
  return balances.some((debt) => debt.balanceMinor > 0) ? null : months;
}
