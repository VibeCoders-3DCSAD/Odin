import { PlanReservations } from "./PlanReservations";
import { obligationRows } from "../helpers/commitmentBudget";
import type { PlanCommitmentPayments } from "../helpers/commitmentPayments";

type Props = {
  obligations: unknown;
  onReservationAmountChange?: (index: number, amount: string) => void;
  onValidityChange?: (key: string, valid: boolean) => void;
  showUnderfundedWarnings?: boolean;
  payments?: PlanCommitmentPayments;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export function PlanScheduledPayments({ obligations, onReservationAmountChange, onValidityChange, showUnderfundedWarnings, payments, collapsible, defaultOpen }: Props) {
  const { reservations, requirements } = obligationRows(obligations);
  return <PlanReservations title="Billers and Remittances" description="Scheduled bills and remittances included in this plan." reservations={reservations.map((row) => ({ ...row, label: row.label ?? "Biller or remittance" }))} requirements={requirements} onReservationAmountChange={onReservationAmountChange} onValidityChange={onValidityChange} showUnderfundedWarnings={showUnderfundedWarnings} payments={payments} collapsible={collapsible} defaultOpen={defaultOpen} showSurplus={false} emptyText="No saved biller or remittance reservations for this period." />;
}
