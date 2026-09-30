import type { FinancialPlanAllocation, FinancialPlanReservation } from "./types";

export function formatPeso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function allocationLabel(allocation: FinancialPlanAllocation): string {
  return allocation.label ?? allocation.subcategoryId ?? allocation.categoryId ?? "Uncategorized";
}

export function reservationLabel(reservation: FinancialPlanReservation): string {
  return reservation.label ?? reservation.savingsGoalId ?? reservation.debtAccountId ?? reservation.creditCardStatementId ?? "Required reservation";
}

export function toCentavos(value: string): number | null {
  const amount = Number(value.trim());
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}
