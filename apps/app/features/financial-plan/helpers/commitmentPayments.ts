import type { FinancialPlanReservation } from "../types";
import { commitmentKey, commitmentTarget, type CommitmentPreview } from "./commitmentBudget";

export type CommitmentPaymentStatus = "paid" | "partial" | "unpaid";
export type CommitmentPayment = { paidCentavos: number; dueCentavos: number; status: CommitmentPaymentStatus };
// settledKeys are biller occurrences marked as paid in full, whatever was paid against them.
export type PlanCommitmentPayments = { paidCentavos: Record<string, number>; settledKeys: string[] };

/**
 * Compares what was paid with what is due for each plan row. Biller payments are recorded per occurrence;
 * savings and debt payments are totals for the period, applied to the earliest due occurrences first.
 */
export function commitmentPayments(rows: FinancialPlanReservation[], requirements: FinancialPlanReservation[], payments: PlanCommitmentPayments): Map<string, CommitmentPayment> {
  const dueAmounts = new Map(requirements.map((row) => [commitmentKey(row), row.amountCentavos]));
  const remaining = new Map(Object.entries(payments.paidCentavos));
  const settled = new Set(payments.settledKeys);
  const ordered = [...rows].sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31"));
  const result = new Map<string, CommitmentPayment>();
  for (const row of ordered) {
    const key = commitmentKey(row);
    const dueCentavos = dueAmounts.get(key) ?? row.amountCentavos;
    if (dueCentavos <= 0) continue;
    const poolKey = row.scheduledPaymentId ? key : commitmentTarget(row);
    const paidCentavos = Math.min(remaining.get(poolKey) ?? 0, dueCentavos);
    if (!row.scheduledPaymentId) remaining.set(poolKey, (remaining.get(poolKey) ?? 0) - paidCentavos);
    result.set(key, { paidCentavos, dueCentavos, status: paidCentavos >= dueCentavos || settled.has(key) ? "paid" : paidCentavos > 0 ? "partial" : "unpaid" });
  }
  return result;
}

/** What was already paid towards each commitment in the preview, capped at its amount due. */
export function previewPaidCentavos(preview: CommitmentPreview, payments: PlanCommitmentPayments | null): Map<string, number> {
  if (!payments) return new Map();
  const rows = [...preview.debtReservations, ...preview.savingsReservations, ...(preview.obligations ?? [])];
  return new Map([...commitmentPayments(rows, rows, payments)].map(([key, payment]) => [key, payment.paidCentavos]));
}
