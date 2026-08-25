export type DebtStrategy = "snowball" | "avalanche";
type PaymentSchedule = {
  dayOfMonth?: string;
  secondDayOfMonth?: string;
  dayOfWeek?: number | null;
  monthOfYear?: number | null;
};
export type DebtLogicInput = {
  id: string;
  balanceMinor: number;
  minimumPaymentMinor: number;
  annualInterestRateBps: number;
  paymentFrequency?: string;
  nextDueDate: string | null;
  lastPaymentDate?: string | null;
  targetPayoffDate: string | null;
  paidPaymentMinor?: number;
  paymentSchedule?: PaymentSchedule;
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
  overdue: boolean;
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

export function cycleExpired(debt: DebtLogicInput, asOfDate: string): boolean {
  const start = debt.lastPaymentDate ? new Date(`${debt.lastPaymentDate}T00:00:00Z`) : null;
  if (!start) return false;
  const days = { daily: 1, weekly: 7, biweekly: 14, semi_monthly: 15, monthly: 30, quarterly: 90, yearly: 365 }[debt.paymentFrequency ?? "monthly"] ?? 30;
  const expiry = new Date(start);
  expiry.setUTCDate(expiry.getUTCDate() + days);
  return expiry < new Date(`${asOfDate}T00:00:00Z`);
}

function isOverdue(debt: DebtLogicInput, asOfDate: string): boolean {
  return Boolean(
    (debt.nextDueDate && debt.nextDueDate < asOfDate)
      || (!debt.nextDueDate && cycleExpired(debt, asOfDate)),
  );
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
    const overdue = isOverdue(debt, input.asOfDate);
    const status = debt.balanceMinor <= 0 ? "Ahead" : paid > requiredPaymentMinor ? "Ahead" : paid >= requiredPaymentMinor || !overdue ? "On Schedule" : "Behind";
    return { ...debt, requiredPaymentMinor, allocatedPaymentMinor: 0, extraPaymentMinor: 0, overdue, status };
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

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function validDay(value: string | undefined, date: Date): boolean {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && date.getUTCDate() === Math.min(day, daysInMonth(date));
}

function hasDay(value: string | undefined): boolean {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

function followsDueDate(debt: DebtLogicInput, date: Date): boolean {
  if (!debt.nextDueDate) return date.getUTCDate() === 1;
  const due = new Date(`${debt.nextDueDate}T00:00:00Z`);
  const days = Math.floor((date.getTime() - due.getTime()) / 86_400_000);
  if (days < 0) return false;
  if (debt.paymentFrequency === "daily") return true;
  if (debt.paymentFrequency === "weekly") return days % 7 === 0;
  if (debt.paymentFrequency === "biweekly") return days % 14 === 0;
  const months = (date.getUTCFullYear() - due.getUTCFullYear()) * 12 + date.getUTCMonth() - due.getUTCMonth();
  if (debt.paymentFrequency === "quarterly") return months >= 0 && months % 3 === 0 && validDay(String(due.getUTCDate()), date);
  if (debt.paymentFrequency === "yearly") return date.getUTCMonth() === due.getUTCMonth() && validDay(String(due.getUTCDate()), date);
  return months >= 0 && validDay(String(due.getUTCDate()), date);
}

function isPaymentDate(debt: DebtLogicInput, date: Date): boolean {
  const schedule = debt.paymentSchedule;
  if (!schedule) return followsDueDate(debt, date);
  if (debt.paymentFrequency === "daily") return true;
  if (debt.paymentFrequency === "weekly" && schedule.dayOfWeek !== null && schedule.dayOfWeek !== undefined) return date.getUTCDay() === schedule.dayOfWeek;
  if (debt.paymentFrequency === "biweekly") return followsDueDate(debt, date);
  if (debt.paymentFrequency === "monthly" && hasDay(schedule.dayOfMonth)) return validDay(schedule.dayOfMonth, date);
  if (debt.paymentFrequency === "semi_monthly" && (hasDay(schedule.dayOfMonth) || hasDay(schedule.secondDayOfMonth))) return validDay(schedule.dayOfMonth, date) || validDay(schedule.secondDayOfMonth, date);
  if (debt.paymentFrequency === "quarterly" && hasDay(schedule.dayOfMonth)) return validDay(schedule.dayOfMonth, date) && followsDueDate(debt, date);
  if (debt.paymentFrequency === "yearly" && schedule.monthOfYear && hasDay(schedule.dayOfMonth)) return date.getUTCMonth() + 1 === schedule.monthOfYear && validDay(schedule.dayOfMonth, date);
  return followsDueDate(debt, date);
}

function scheduledPaymentsThisMonth(debt: DebtLogicInput, from: Date): number {
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0));
  let count = 0;
  while (cursor <= end) {
    if (isPaymentDate(debt, cursor)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function monthsUntil(start: Date, end: Date): number {
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  return months + Number(end.getUTCDate() > start.getUTCDate());
}

export function forecastDebtFreeMonths(debts: DebtLogicInput[], monthlyPaymentMinor: number, strategy: DebtStrategy = "avalanche", priorities: string[] = [], asOfDate = formatDate(new Date())): number | null {
  if (monthlyPaymentMinor <= 0) return debts.some((debt) => debt.balanceMinor > 0) ? null : 0;
  const balances = debts.filter((debt) => debt.balanceMinor > 0).map((debt) => ({ ...debt, balanceMinor: debt.balanceMinor }));
  const start = new Date(`${asOfDate}T00:00:00Z`);
  const cursor = new Date(start);
  const reserved = new Map<string, number>();
  const monthlyRemaining = new Map<string, number>();
  const remainingPayments = new Map<string, number>();
  let month = "";

  for (let day = 0; day < 36_600; day++) {
    const nextMonth = cursor.toISOString().slice(0, 7);
    if (nextMonth !== month) {
      month = nextMonth;
      const plan = calculateDebtPlan({ debts: balances, debtBudgetMinor: monthlyPaymentMinor, strategy, priorities, asOfDate: formatDate(cursor) });
      for (const allocation of plan.allocations) {
        reserved.set(allocation.id, (reserved.get(allocation.id) ?? 0) + allocation.allocatedPaymentMinor);
        monthlyRemaining.set(allocation.id, allocation.allocatedPaymentMinor);
        remainingPayments.set(allocation.id, scheduledPaymentsThisMonth(allocation, cursor));
      }
    }

    for (const debt of balances) {
      if (debt.balanceMinor <= 0 || !isPaymentDate(debt, cursor)) continue;
      const payments = remainingPayments.get(debt.id) ?? 0;
      const monthlyAmount = monthlyRemaining.get(debt.id) ?? 0;
      const scheduledAmount = payments ? Math.ceil(monthlyAmount / payments) : 0;
      const payment = Math.min(debt.balanceMinor, (reserved.get(debt.id) ?? 0) - monthlyAmount + scheduledAmount);
      debt.balanceMinor -= payment;
      reserved.set(debt.id, (reserved.get(debt.id) ?? 0) - payment);
      monthlyRemaining.set(debt.id, monthlyAmount - scheduledAmount);
      remainingPayments.set(debt.id, payments - 1);
    }

    if (!balances.some((debt) => debt.balanceMinor > 0)) return monthsUntil(start, cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return null;
}
