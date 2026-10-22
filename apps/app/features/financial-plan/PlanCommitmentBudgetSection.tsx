import { Text, View } from "react-native";
import { PlanReservations } from "./PlanReservations";
import { formatPeso } from "./financialPlanPresentation";
import type { CommitmentPreview } from "./helpers/commitmentBudget";

type Props = {
  requirements: CommitmentPreview | null; draft: CommitmentPreview | null; remainingCentavos: number;
  onAmountChange: (kind: "debtReservations" | "savingsReservations", index: number, amount: string) => void;
  onValidityChange: (key: string, valid: boolean) => void;
};

export function PlanCommitmentBudgetSection({ requirements, draft, remainingCentavos, onAmountChange, onValidityChange }: Props) {
  const overBudget = remainingCentavos < 0;
  return <View style={{ marginTop: 16 }}>
      <Text accessibilityRole="header" style={{ fontFamily: "Manrope", fontSize: 16, fontWeight: "800", color: "#1B1C1A" }}>Plan debt &amp; savings</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 4 }}>Review what is due and when, then choose how much to set aside for each payment and savings goal.</Text>
      <PlanReservations title="Debt repayments" description="Compare your budget with each amount due." requirements={requirements?.debtReservations} reservations={draft?.debtReservations ?? []} onReservationAmountChange={(index, amount) => onAmountChange("debtReservations", index, amount)} onValidityChange={onValidityChange} showSurplus={false} />
      <PlanReservations title="Savings contributions" description="Use your contribution schedule to keep your goals on track." requirements={requirements?.savingsReservations} reservations={draft?.savingsReservations ?? []} onReservationAmountChange={(index, amount) => onAmountChange("savingsReservations", index, amount)} onValidityChange={onValidityChange} showSurplus={false} />
      <Text accessibilityRole={overBudget ? "alert" : undefined} style={{ fontFamily: "Manrope", fontSize: 12, color: overBudget ? "#D9001F" : "#416153", marginTop: 10 }}>{overBudget ? "Debt and savings budgets exceed your planning amount." : `After debt and savings: ${formatPeso(remainingCentavos)} for bills and spending categories.`}</Text>
    </View>;
}
