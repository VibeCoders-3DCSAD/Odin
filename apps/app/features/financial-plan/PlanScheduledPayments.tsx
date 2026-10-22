import { PlanReservations } from "./PlanReservations";
import type { FinancialPlanReservation } from "./types";

type ScheduledReservation = FinancialPlanReservation & { scheduledPaymentId: string };

function isScheduledReservation(value: unknown): value is ScheduledReservation {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.scheduledPaymentId === "string" && Number.isSafeInteger(row.amountCentavos) && (row.amountCentavos as number) >= 0
    && (row.label == null || typeof row.label === "string") && (row.dueDate == null || typeof row.dueDate === "string");
}

export function PlanScheduledPayments({ obligations }: { obligations: unknown }) {
  const snapshot = obligations && typeof obligations === "object" ? obligations as Record<string, unknown> : {};
  const reservations = Array.isArray(snapshot.reservations) ? snapshot.reservations.filter(isScheduledReservation) : [];
  return <PlanReservations title="Billers and Remittances" description="Scheduled bills and remittances included in this plan." reservations={reservations.map((row) => ({ ...row, label: row.label ?? "Biller or remittance" }))} showSurplus={false} emptyText="No saved biller or remittance reservations for this period." />;
}
