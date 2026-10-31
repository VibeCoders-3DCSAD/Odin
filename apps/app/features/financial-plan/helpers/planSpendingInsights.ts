import { allocationLabel, formatPeso } from "./financialPlanPresentation";
import type { FinancialPlanAllocation } from "../types";

type SpendingInsightInput = {
  allocations: FinancialPlanAllocation[];
  spentCentavos: number;
  period: { start: string; end: string };
  today: string;
  funds?: { remainingCentavos: number; commitmentsCentavos: number };
};

function percentage(amount: number, total: number): string {
  return `${(amount / total * 100).toLocaleString("en-PH", { maximumFractionDigits: 1 })}%`;
}

function remainingDescription(budget: number, spent: number): string {
  return spent > budget
    ? `${formatPeso(spent - budget)} over budget.`
    : `${formatPeso(budget - spent)} remaining.`;
}

function summaryInsight(budget: number, spent: number): string {
  if (budget === 0) return spent > 0
    ? `You've recorded ${formatPeso(spent)} in category spending, with no category budget allocated.`
    : "No category spending recorded yet. This plan has no category budget allocated.";
  return `You've spent ${formatPeso(spent)} of your ${formatPeso(budget)} category budget (${percentage(spent, budget)} used). ${remainingDescription(budget, spent)}`;
}

function planBalanceInsight(funds: SpendingInsightInput["funds"]): string | null {
  if (!funds) return null;
  const balance = funds.remainingCentavos < 0
    ? `Your plan is ${formatPeso(-funds.remainingCentavos)} over budget.`
    : `${formatPeso(funds.remainingCentavos)} remains in your plan.`;
  return funds.commitmentsCentavos > 0
    ? `${balance} Your budgeted commitments of ${formatPeso(funds.commitmentsCentavos)} are already accounted for.`
    : balance;
}

function categoryInsight(allocations: FinancialPlanAllocation[]): string | null {
  const [category] = allocations.filter((allocation) => (allocation.spentAmountCentavos ?? 0) > 0).sort((left, right) => {
    const leftSpent = left.spentAmountCentavos ?? 0;
    const rightSpent = right.spentAmountCentavos ?? 0;
    const leftOver = Math.max(0, leftSpent - left.allocatedAmountCentavos);
    const rightOver = Math.max(0, rightSpent - right.allocatedAmountCentavos);
    return rightOver - leftOver || rightSpent / Math.max(1, right.allocatedAmountCentavos) - leftSpent / Math.max(1, left.allocatedAmountCentavos);
  });
  if (!category) return null;
  const spent = category.spentAmountCentavos ?? 0;
  const budget = category.allocatedAmountCentavos;
  return budget === 0
    ? `${allocationLabel(category)} has ${formatPeso(spent)} in recorded spending with no budget allocated.`
    : `${allocationLabel(category)}: ${formatPeso(spent)} of ${formatPeso(budget)} spent (${percentage(spent, budget)} used). ${remainingDescription(budget, spent)}`;
}

function periodInsight(period: SpendingInsightInput["period"], today: string, budget: number, spent: number): string | null {
  const start = Date.parse(`${period.start}T00:00:00Z`);
  const end = Date.parse(`${period.end}T00:00:00Z`);
  const current = Date.parse(`${today}T00:00:00Z`);
  if (![start, end, current].every(Number.isFinite) || end < start) return null;
  if (current < start) return "This plan period has not started.";
  if (current > end) return "This plan period has ended.";
  const dayMs = 86_400_000;
  const days = Math.round((end - start) / dayMs) + 1;
  const elapsed = Math.round((current - start) / dayMs) + 1;
  const usage = budget > 0 ? ` ${percentage(spent, budget)} of your category budget is used.` : "";
  return `Day ${elapsed} of ${days} in this plan (${percentage(elapsed, days)} through the period).${usage}`;
}

export function planSpendingInsights({ allocations, spentCentavos, period, today, funds }: SpendingInsightInput): string[] {
  const budget = allocations.reduce((sum, allocation) => sum + allocation.allocatedAmountCentavos, 0);
  const plannedCategorySpending = allocations.reduce((sum, allocation) => sum + (allocation.spentAmountCentavos ?? 0), 0);
  const unplanned = Math.max(0, spentCentavos - plannedCategorySpending);
  const outsidePlan = unplanned > 0
    ? `${formatPeso(unplanned)} of recorded spending (${percentage(unplanned, spentCentavos)}) is outside the categories in this plan.` : null;
  return [planBalanceInsight(funds), summaryInsight(budget, spentCentavos), outsidePlan, categoryInsight(allocations), periodInsight(period, today, budget, spentCentavos)]
    .filter((message): message is string => message !== null)
    .slice(0, funds ? 4 : 3);
}
