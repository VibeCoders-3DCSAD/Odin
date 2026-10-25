import type { PlanCommitmentStatus } from "./pastPlanTypes";
import type { FinancialPlanAllocation, FinancialPlanReservation, FinancialPlanSurplusRecommendation } from "./types";

export type FinancialPlanLabels = {
  categories: Record<string, string>;
  subcategories: Record<string, string>;
  debtAccounts: Record<string, string>;
  savingsGoals: Record<string, string>;
  creditCardStatements: Record<string, string>;
  /** Ids of soft-deleted entities, populated when labels are loaded with includeDeleted (D8). */
  removedIds?: string[];
};

export function formatPeso(centavos: number): string {
  return `${centavos < 0 ? "-" : ""}₱${(Math.abs(centavos) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatForecastPeso(centavos: number): string {
  const fractionDigits = centavos % 100 === 0 ? 0 : 2;
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: fractionDigits, maximumFractionDigits: 2 })}`;
}

export function remainingUnallocatedCentavos(availableFundsCentavos: number, allocations: FinancialPlanAllocation[], debtSurplusCentavos = 0, savingsSurplusCentavos = 0): number {
  return availableFundsCentavos - allocations.reduce((total, allocation) => total + allocation.allocatedAmountCentavos, 0) - debtSurplusCentavos - savingsSurplusCentavos;
}

export function applyFinancialPlanSpending(allocations: FinancialPlanAllocation[], spending: Record<string, number>): FinancialPlanAllocation[] {
  return allocations.map((allocation) => ({
    ...allocation,
    spentAmountCentavos: spending[allocation.categoryId ? `category:${allocation.categoryId}` : `subcategory:${allocation.subcategoryId}`] ?? 0,
  }));
}

export function allocationLabel(allocation: FinancialPlanAllocation): string {
  return allocation.label ?? (allocation.subcategoryId ? "Expense category" : allocation.categoryId ? "Category" : "Uncategorized");
}

export function reservationLabel(reservation: FinancialPlanReservation): string {
  return reservation.label ?? (reservation.savingsGoalId ? "Savings goal" : reservation.debtAccountId ? "Debt account" : reservation.creditCardStatementId ? "Credit card statement" : reservation.scheduledPaymentId ? "Biller or remittance" : "Required reservation");
}

export function applyFinancialPlanLabels<T extends { allocations: FinancialPlanAllocation[]; debtReservations: FinancialPlanReservation[]; savingsReservations: FinancialPlanReservation[]; surplusRecommendation?: FinancialPlanSurplusRecommendation }>(recommendation: T, labels: FinancialPlanLabels): T {
  const destination = recommendation.surplusRecommendation?.advisoryDestination;
  return {
    ...recommendation,
    allocations: recommendation.allocations.map((allocation) => ({ ...allocation, label: allocation.subcategoryId ? labels.subcategories[allocation.subcategoryId] : allocation.categoryId ? labels.categories[allocation.categoryId] : undefined })),
    debtReservations: recommendation.debtReservations.map((reservation) => ({ ...reservation, label: reservation.debtAccountId ? labels.debtAccounts[reservation.debtAccountId] : reservation.creditCardStatementId ? labels.creditCardStatements[reservation.creditCardStatementId] : undefined })),
    savingsReservations: recommendation.savingsReservations.map((reservation) => ({ ...reservation, label: reservation.savingsGoalId ? labels.savingsGoals[reservation.savingsGoalId] : undefined })),
    ...(destination ? { surplusRecommendation: { ...recommendation.surplusRecommendation, advisoryDestination: { ...destination, label: destination.type === "debt" ? labels.debtAccounts[destination.debtAccountId] : labels.savingsGoals[destination.savingsGoalId] } } } : {}),
  };
}

export function toCentavos(value: string): number | null {
  const amount = Number(value.trim());
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatPlanMonthLabel(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate);
  const monthName = match ? MONTH_NAMES[Number(match[2]) - 1] : undefined;
  return match && monthName ? `${monthName} ${match[1]}` : isoDate;
}

export function commitmentStatusLabel(status: PlanCommitmentStatus, kind: "savings" | "debt"): string {
  if (status === "met") return "Met";
  if (status === "partial") return "Partial";
  if (status === "not_recorded") return kind === "savings" ? "No contribution recorded" : "No payment recorded";
  return kind === "savings" ? "Additional contribution" : "Additional payment";
}

export function labelWithRemovedSuffix(label: string, id: string | null | undefined, removedIds: readonly string[] = []): string {
  return id && removedIds.includes(id) ? `${label} (removed)` : label;
}
