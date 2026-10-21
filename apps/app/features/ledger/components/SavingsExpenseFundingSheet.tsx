import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { BottomSheetSurface } from "../../../components/BottomSheetSurface";
import { Banner, Note, TextField, v4, v4Font } from "../../../components/BudgieForm";
import { newSavingsExpenseWithdrawal, type SavingsExpenseFunding, type SavingsExpenseWithdrawal } from "../../../local-db/repositories/savingsExpenseFunding";

function money(value: number) { return `₱${(value / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`; }
function parse(value: string): number {
  return /^\d+(\.\d{1,2})?$/.test(value.trim()) ? Math.round(Number(value) * 100) : 0;
}

type Props = { funding: SavingsExpenseFunding; onCancel: () => void; onConfirm: (withdrawals: SavingsExpenseWithdrawal[]) => void };
export default function SavingsExpenseFundingSheet({ funding, onCancel, onConfirm }: Props) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const selected = funding.goals.map((goal) => ({ goal, amount: parse(amounts[goal.id] ?? "") }));
  const total = selected.reduce((sum, item) => sum + item.amount, 0);
  const valid = total === funding.requiredWithdrawalCentavos && selected.every(({ goal, amount }) => amount <= goal.availableCentavos)
    && Object.values(amounts).every((value) => !value.trim() || /^\d+(\.\d{1,2})?$/.test(value.trim()));
  return <Modal transparent animationType="slide" onRequestClose={onCancel}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}><BottomSheetSurface style={{ backgroundColor: v4.surface, maxHeight: "85%", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: v4Font, color: v4.ink, fontSize: 20, fontWeight: "700" }}>Use savings goal money?</Text>
        <Note>This expense uses {money(funding.unallocatedCentavos)} in unallocated money first. Choose which goals cover the remaining {money(funding.requiredWithdrawalCentavos)}.</Note>
        {funding.existingShortfallCentavos > 0 ? <Banner tone="warn">{`Your goals already exceed this account's balance by ${money(funding.existingShortfallCentavos)}. Review their allocations.`}</Banner> : null}
        {funding.goals.filter((goal) => goal.availableCentavos > 0).map((goal) => <View key={goal.id} style={{ gap: 6 }}>
          <Text style={{ fontFamily: v4Font, color: v4.ink }}>{goal.name} · {money(goal.availableCentavos)} saved</Text>
          <TextField label={`Withdraw from ${goal.name}`} accessibilityLabel={`Withdraw from ${goal.name}`} value={amounts[goal.id] ?? ""} onChangeText={(value) => setAmounts((current) => ({ ...current, [goal.id]: value }))} keyboardType="decimal-pad" placeholder="0.00" />
        </View>)}
        <Note>Selected {money(total)} of {money(funding.requiredWithdrawalCentavos)}. Confirming reduces only the selected goals. Editing or deleting this expense updates these withdrawals.</Note>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid }} disabled={!valid} style={{ padding: 16, opacity: valid ? 1 : 0.4 }} onPress={() => onConfirm(selected.filter((item) => item.amount > 0).map(({ goal, amount }) => newSavingsExpenseWithdrawal(goal.id, amount)))}><Text style={{ fontFamily: v4Font, color: v4.brand, fontWeight: "700", textAlign: "center" }}>Confirm withdrawals and save</Text></Pressable>
        <Pressable accessibilityRole="button" style={{ padding: 16 }} onPress={onCancel}><Text style={{ fontFamily: v4Font, color: v4.ink, textAlign: "center" }}>Cancel</Text></Pressable>
      </ScrollView>
    </BottomSheetSurface></View>
  </Modal>;
}
