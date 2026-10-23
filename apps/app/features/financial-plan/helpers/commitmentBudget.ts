import type { FinancialPlanRecommendation, FinancialPlanReservation } from "../types";

export type CommitmentPreview = { period: { start: string; end: string }; debtReservations: FinancialPlanReservation[]; savingsReservations: FinancialPlanReservation[]; obligations?: FinancialPlanReservation[] };
export type CommitmentBudget = { key: string; amountCentavos: number };

export function commitmentKey(row: FinancialPlanReservation): string {
  return `${row.debtAccountId ? `debt:${row.debtAccountId}` : row.creditCardStatementId ? `statement:${row.creditCardStatementId}` : `savings:${row.savingsGoalId}`}:${row.dueDate}`;
}

export function parseBudgetAmount(value: string): number | null {
  if (!/^\d+(\.\d{0,2})?$/.test(value.trim())) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents <= 100_000_000_000 ? cents : null;
}

export function requirementReservations(snapshot: Record<string, unknown> | undefined): FinancialPlanReservation[] {
  if (!Array.isArray(snapshot?.reservations)) return [];
  return snapshot.reservations.filter((row): row is FinancialPlanReservation => !!row && typeof row === "object" && typeof row.amountCentavos === "number");
}

export function updateCommitmentBudget(plan: FinancialPlanRecommendation, kind: "debtReservations" | "savingsReservations", index: number, amountCentavos: number): FinancialPlanRecommendation {
  const current = plan.recommendation;
  const row = current[kind][index];
  if (!row) return plan;
  const delta = amountCentavos - row.amountCentavos;
  const availableFundsCentavos = current.availableFundsCentavos - delta;
  const requiredCategoryFunds = current.allocations.reduce((sum, allocation) => sum + allocation.floorAmountCentavos, 0);
  const shortfallCentavos = Math.max(0, requiredCategoryFunds - availableFundsCentavos);
  return { ...plan, status: shortfallCentavos > 0 ? "INFEASIBLE" : "RECOMMENDATION_READY", recommendation: { ...current, availableFundsCentavos, requiredFundsCentavos: current.requiredFundsCentavos == null ? undefined : current.requiredFundsCentavos + delta, shortfallCentavos, [kind]: current[kind].map((item, rowIndex) => rowIndex === index ? { ...item, amountCentavos } : item) } };
}
