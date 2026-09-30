import type { FinancialPlanAllocation, FinancialPlanReservation } from "./types";

export type FinancialPlanLabels = {
  categories: Record<string, string>;
  subcategories: Record<string, string>;
  debtAccounts: Record<string, string>;
  savingsGoals: Record<string, string>;
  creditCardStatements: Record<string, string>;
};

export function formatPeso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function allocationLabel(allocation: FinancialPlanAllocation): string {
  return allocation.label ?? (allocation.subcategoryId ? "Expense category" : allocation.categoryId ? "Category" : "Uncategorized");
}

export function reservationLabel(reservation: FinancialPlanReservation): string {
  return reservation.label ?? (reservation.savingsGoalId ? "Savings goal" : reservation.debtAccountId ? "Debt account" : reservation.creditCardStatementId ? "Credit card statement" : "Required reservation");
}

export function applyFinancialPlanLabels<T extends { allocations: FinancialPlanAllocation[]; debtReservations: FinancialPlanReservation[]; savingsReservations: FinancialPlanReservation[] }>(recommendation: T, labels: FinancialPlanLabels): T {
  return {
    ...recommendation,
    allocations: recommendation.allocations.map((allocation) => ({ ...allocation, label: allocation.subcategoryId ? labels.subcategories[allocation.subcategoryId] : allocation.categoryId ? labels.categories[allocation.categoryId] : undefined })),
    debtReservations: recommendation.debtReservations.map((reservation) => ({ ...reservation, label: reservation.debtAccountId ? labels.debtAccounts[reservation.debtAccountId] : reservation.creditCardStatementId ? labels.creditCardStatements[reservation.creditCardStatementId] : undefined })),
    savingsReservations: recommendation.savingsReservations.map((reservation) => ({ ...reservation, label: reservation.savingsGoalId ? labels.savingsGoals[reservation.savingsGoalId] : undefined })),
  };
}

export function toCentavos(value: string): number | null {
  const amount = Number(value.trim());
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}
