import { Text, View } from "react-native";
import { PlanReservations } from "./PlanReservations";
import type { ReservationSkips } from "../api";
import type { CommitmentKind, CommitmentPreview } from "../helpers/commitmentBudget";
import type { PlanCommitmentPayments } from "../helpers/commitmentPayments";

type Props = {
  requirements: CommitmentPreview; draft: CommitmentPreview; skips: ReservationSkips;
  payments?: PlanCommitmentPayments;
  onAmountChange: (kind: CommitmentKind, index: number, amount: string) => void;
  onValidityChange: (key: string, valid: boolean) => void;
};

export function PlanCommitmentBudgetSection({ requirements, draft, skips, payments, onAmountChange, onValidityChange }: Props) {
  return <View style={{ marginTop: 4 }}>
      {!skips.savingsContributions ? <PlanReservations title="Savings contributions" description="How much to set aside for each savings goal." requirements={requirements.savingsReservations} reservations={draft.savingsReservations} onReservationAmountChange={(index, amount) => onAmountChange("savingsReservations", index, amount)} onValidityChange={onValidityChange} showSurplus={false} showUnderfundedWarnings={false} payments={payments} /> : null}
      {!skips.debtRepayments ? <PlanReservations title="Debt repayments" description="How much to set aside for each payment." requirements={requirements.debtReservations} reservations={draft.debtReservations} onReservationAmountChange={(index, amount) => onAmountChange("debtReservations", index, amount)} onValidityChange={onValidityChange} showSurplus={false} showUnderfundedWarnings={false} payments={payments} /> : null}
      {!skips.scheduledPayments && draft.obligations?.length ? <PlanReservations title="Billers and Remittances" description="How much to set aside for each bill and remittance." requirements={requirements.obligations ?? []} reservations={draft.obligations} onReservationAmountChange={(index, amount) => onAmountChange("obligations", index, amount)} onValidityChange={onValidityChange} showSurplus={false} showUnderfundedWarnings={false} payments={payments} /> : null}
    </View>;
}
