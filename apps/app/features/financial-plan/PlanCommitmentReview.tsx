import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReservationSkips } from "./api";
import { PlanCommitmentBudgetSection } from "./PlanCommitmentBudgetSection";
import { UnderfundedCommitmentsDialog } from "./UnderfundedCommitmentsDialog";
import { formatPeso } from "./financialPlanPresentation";
import { commitmentTotals, hasUnderfundedCommitment, type CommitmentKind, type CommitmentPreview } from "./helpers/commitmentBudget";

type Props = {
  requirements: CommitmentPreview;
  draft: CommitmentPreview;
  skips: ReservationSkips;
  plannedAmountCentavos: number;
  invalid: boolean;
  error: string | null;
  onAmountChange: (kind: CommitmentKind, index: number, amount: string) => void;
  onValidityChange: (key: string, valid: boolean) => void;
  onBack: () => void;
  // The next step decides how the remaining money reaches categories (ML recommendation or manual entry).
  actionLabel?: string;
  onAllocate: () => void;
};

export function PlanCommitmentReview({ requirements, draft, skips, plannedAmountCentavos, invalid, error, onAmountChange, onValidityChange, onBack, actionLabel = "Calculate Allocations", onAllocate }: Props) {
  const { savingsCentavos: savings, debtCentavos: debt, scheduledCentavos: bills, remainingCentavos: remaining } = commitmentTotals(draft, skips, plannedAmountCentavos);
  const disabled = invalid || remaining < 0;
  // Amounts below what is due are confirmed in a dialog when the user moves on, not flagged while they type.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const allocate = () => {
    if (hasUnderfundedCommitment(requirements, draft, skips)) setConfirmOpen(true);
    else onAllocate();
  };
  return <View style={styles.page}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to plan setup" onPress={onBack} style={styles.back}><Text style={styles.backText}>‹ Back to setup</Text></Pressable>
    <Text accessibilityRole="header" style={styles.heading}>Financial Plan</Text>
    <Text style={styles.description}>Set aside money for each savings goal, debt, bill and remittance for {draft.period.start} to {draft.period.end}, then allocate the remaining money to your categories.</Text>
    <PlanCommitmentBudgetSection requirements={requirements} draft={draft} skips={skips} onAmountChange={onAmountChange} onValidityChange={onValidityChange} />
    {skips.debtRepayments ? <Text style={styles.description}>Debt repayments excluded from this plan. Existing payments are still due.</Text> : null}
    {skips.savingsContributions ? <Text style={styles.description}>Savings contributions excluded from this plan.</Text> : null}
    {skips.scheduledPayments ? <Text style={styles.description}>Billers and remittances excluded from this plan. Existing bills are still due.</Text> : null}
    <View style={styles.summary}>
      {([
        ["Planning amount", plannedAmountCentavos],
        ["Savings contributions", -savings],
        ["Debt repayments", -debt],
        ["Billers and remittances", -bills],
      ] as const).map(([label, amount]) => <View key={label} style={styles.row}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryAmount}>{formatPeso(amount)}</Text></View>)}
      <View style={[styles.row, styles.total]}><Text style={styles.totalLabel}>Remaining money in plan</Text><Text style={styles.totalAmount}>{invalid ? "Check amounts" : formatPeso(remaining)}</Text></View>
    </View>
    {remaining < 0 ? <Text accessibilityRole="alert" style={styles.error}>Your planned payments exceed the planning amount. Reduce an amount or return to setup.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} disabled={disabled} onPress={allocate} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{actionLabel}</Text></Pressable>
    <UnderfundedCommitmentsDialog visible={confirmOpen} onCancel={() => setConfirmOpen(false)} onConfirm={() => { setConfirmOpen(false); onAllocate(); }} />
  </View>;
}

const styles = StyleSheet.create({
  page: { paddingBottom: 28 },
  back: { alignSelf: "flex-start", paddingVertical: 12 },
  backText: { fontFamily: "Manrope", fontSize: 12, fontWeight: "700", color: "#0E6D46" },
  heading: { fontFamily: "Manrope", fontSize: 20, fontWeight: "800", color: "#1B1C1A" },
  description: { fontFamily: "Manrope", fontSize: 12, lineHeight: 18, color: "#6B7A6F", marginTop: 8 },
  summary: { backgroundColor: "#013220", borderRadius: 16, padding: 16, marginTop: 20, gap: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryLabel: { flex: 1, fontFamily: "Manrope", fontSize: 12, color: "#D7EEE2" },
  summaryAmount: { fontFamily: "Manrope", fontSize: 12, color: "#FFFFFF" },
  total: { borderTopWidth: 1, borderTopColor: "#416153", paddingTop: 12, flexWrap: "wrap" },
  totalLabel: { fontFamily: "Manrope", fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  totalAmount: { fontFamily: "Manrope", fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  error: { fontFamily: "Manrope", fontSize: 12, color: "#D9001F", marginTop: 12 },
  button: { backgroundColor: "#013220", borderRadius: 14, padding: 16, marginTop: 20 },
  disabled: { opacity: 0.5 },
  buttonText: { fontFamily: "Manrope", fontSize: 14, fontWeight: "800", color: "#FFFFFF", textAlign: "center" },
});
