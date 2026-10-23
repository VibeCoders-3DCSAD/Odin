import { Text, View } from "react-native";
import { PlanReservations } from "./PlanReservations";
import type { ReservationSkips } from "./api";
import type { CommitmentPreview } from "./helpers/commitmentBudget";

type Props = {
  requirements: CommitmentPreview; draft: CommitmentPreview; skips: ReservationSkips;
  onAmountChange: (kind: "debtReservations" | "savingsReservations", index: number, amount: string) => void;
  onValidityChange: (key: string, valid: boolean) => void;
};

export function PlanCommitmentBudgetSection({ requirements, draft, skips, onAmountChange, onValidityChange }: Props) {
  return <View style={{ marginTop: 16 }}>
      {!skips.savingsContributions ? <PlanReservations title="Savings contributions" description="Choose how much to set aside for each savings goal." requirements={requirements.savingsReservations} reservations={draft.savingsReservations} onReservationAmountChange={(index, amount) => onAmountChange("savingsReservations", index, amount)} onValidityChange={onValidityChange} showSurplus={false} /> : null}
      {!skips.debtRepayments ? <PlanReservations title="Debt repayments" description="Choose how much to set aside for each payment." requirements={requirements.debtReservations} reservations={draft.debtReservations} onReservationAmountChange={(index, amount) => onAmountChange("debtReservations", index, amount)} onValidityChange={onValidityChange} showSurplus={false} /> : null}
    </View>;
}
