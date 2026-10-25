import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReservationSkips } from "./api";
import { PlanBackLink } from "./PlanBackLink";
import { PlanCommitmentBudgetSection } from "./PlanCommitmentBudgetSection";
import { UnderfundedCommitmentsDialog } from "./UnderfundedCommitmentsDialog";
import { formatPeso } from "./financialPlanPresentation";
import type { PlanCommitmentPayments } from "./helpers/commitmentPayments";
import { commitmentTotals, hasUnderfundedCommitment, type CommitmentKind, type CommitmentPreview } from "./helpers/commitmentBudget";

type Props = {
  requirements: CommitmentPreview;
  draft: CommitmentPreview;
  skips: ReservationSkips;
  // What was already paid this period, shown on each row.
  payments?: PlanCommitmentPayments;
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

export function PlanCommitmentReview({ requirements, draft, skips, payments, plannedAmountCentavos, invalid, error, onAmountChange, onValidityChange, onBack, actionLabel = "Calculate Allocations", onAllocate }: Props) {
  const { savingsCentavos: savings, debtCentavos: debt, scheduledCentavos: bills, remainingCentavos: remaining } = commitmentTotals(draft, skips, plannedAmountCentavos);
  const disabled = invalid || remaining < 0;
  // Amounts below what is due are confirmed in a dialog when the user moves on, not flagged while they type.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const allocate = () => {
    if (hasUnderfundedCommitment(requirements, draft, skips)) setConfirmOpen(true);
    else onAllocate();
  };
  const breakdown = ([
    ["Savings", savings, !skips.savingsContributions],
    ["Debt", debt, !skips.debtRepayments],
    ["Bills", bills, !skips.scheduledPayments],
  ] as const).filter(([, , shown]) => shown);
  const overBudget = remaining < 0;
  return <View style={styles.page}>
    <View style={styles.back}><PlanBackLink onPress={onBack} /></View>
    <Text accessibilityRole="header" style={styles.heading}>Financial Plan</Text>
    <Text style={styles.description}>Set aside money for each commitment from {draft.period.start} to {draft.period.end}. What's left goes to your categories.</Text>
    <View style={styles.summary}>
      <Text style={styles.summaryLabel}>Left for categories</Text>
      <Text accessibilityRole={overBudget ? "alert" : undefined} style={[styles.totalAmount, overBudget && styles.overAmount]}>{invalid ? "Check amounts" : formatPeso(remaining)}</Text>
      <Text style={styles.summaryLabel}>of {formatPeso(plannedAmountCentavos)} planning amount</Text>
      <View style={styles.breakdown}>
        {breakdown.map(([label, amount]) => <View key={label} style={styles.breakdownItem}><Text style={styles.breakdownLabel}>{label}</Text><Text style={styles.breakdownAmount}>{formatPeso(amount)}</Text></View>)}
      </View>
    </View>
    {skips.debtRepayments || skips.savingsContributions || skips.scheduledPayments ? <View style={styles.notice}>
      {skips.debtRepayments ? <Text style={styles.noticeText}>Debt repayments excluded from this plan. Existing payments are still due.</Text> : null}
      {skips.savingsContributions ? <Text style={styles.noticeText}>Savings contributions excluded from this plan.</Text> : null}
      {skips.scheduledPayments ? <Text style={styles.noticeText}>Billers and remittances excluded from this plan. Existing bills are still due.</Text> : null}
    </View> : null}
    <PlanCommitmentBudgetSection requirements={requirements} draft={draft} skips={skips} payments={payments} onAmountChange={onAmountChange} onValidityChange={onValidityChange} />
    <View style={styles.footer}>
      {overBudget ? <Text accessibilityRole="alert" style={styles.error}>Your planned payments exceed the planning amount. Reduce an amount or return to setup.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!invalid && !overBudget ? <Text style={styles.footerNote}>{formatPeso(remaining)} will be allocated to your categories</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} disabled={disabled} onPress={allocate} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{actionLabel}</Text></Pressable>
    </View>
    <UnderfundedCommitmentsDialog visible={confirmOpen} onCancel={() => setConfirmOpen(false)} onConfirm={() => { setConfirmOpen(false); onAllocate(); }} />
  </View>;
}

const styles = StyleSheet.create({
  page: { paddingBottom: 28 },
  back: { paddingVertical: 8 },
  heading: { fontFamily: "Manrope", fontSize: 20, fontWeight: "800", color: "#1B1C1A" },
  description: { fontFamily: "Manrope", fontSize: 12, lineHeight: 18, color: "#6B7A6F", marginTop: 4 },
  summary: { backgroundColor: "#013220", borderRadius: 16, padding: 16, marginTop: 16 },
  summaryLabel: { fontFamily: "Manrope", fontSize: 12, color: "#D7EEE2" },
  totalAmount: { fontFamily: "Manrope", fontSize: 25, fontWeight: "800", color: "#FFFFFF", marginVertical: 2 },
  overAmount: { color: "#FFB4AB" },
  breakdown: { flexDirection: "row", gap: 8, marginTop: 14, borderTopWidth: 1, borderTopColor: "#416153", paddingTop: 12 },
  breakdownItem: { flex: 1 },
  breakdownLabel: { fontFamily: "Manrope", fontSize: 11, color: "#9FC2B0" },
  breakdownAmount: { fontFamily: "Manrope", fontSize: 13, fontWeight: "800", color: "#FFFFFF", marginTop: 2 },
  notice: { backgroundColor: "#FFF8E7", borderColor: "#F2D9A3", borderRadius: 14, borderWidth: 1, marginTop: 12, padding: 12, gap: 4 },
  noticeText: { fontFamily: "Manrope", fontSize: 11.5, lineHeight: 17, color: "#6F4A00" },
  footer: { marginTop: 22, borderTopWidth: 1, borderTopColor: "#EAEAE6", paddingTop: 14 },
  footerNote: { fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", textAlign: "center" },
  error: { fontFamily: "Manrope", fontSize: 12, color: "#D9001F", textAlign: "center" },
  button: { backgroundColor: "#013220", borderRadius: 14, padding: 16, marginTop: 10 },
  disabled: { opacity: 0.5 },
  buttonText: { fontFamily: "Manrope", fontSize: 14, fontWeight: "800", color: "#FFFFFF", textAlign: "center" },
});
