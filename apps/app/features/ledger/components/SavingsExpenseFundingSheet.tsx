import { useState } from "react";
import { Check } from "phosphor-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BottomSheetSurface } from "../../../components/BottomSheetSurface";
import { ActionSheet } from "../../../components/ActionSheet";
import { Banner, Note, v4, v4Font } from "../../../components/BudgieForm";
import { newSavingsExpenseWithdrawal, type SavingsExpenseFunding, type SavingsExpenseWithdrawal } from "../../../local-db/repositories/savings/savingsExpenseFunding";

function money(value: number) { return `₱${(value / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`; }

type Props = { funding: SavingsExpenseFunding | null; onCancel: () => void; onConfirm: (withdrawals: SavingsExpenseWithdrawal[]) => void };
export default function SavingsExpenseFundingSheet({ funding, onCancel, onConfirm }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  let remaining = funding?.requiredWithdrawalCentavos ?? 0;
  const selected = selectedIds.flatMap((id) => {
    const goal = funding?.goals.find((item) => item.id === id);
    if (!goal || goal.availableCentavos <= 0) return [];
    const amount = Math.min(remaining, goal.availableCentavos);
    remaining -= amount;
    return [{ goal, amount }];
  });
  const valid = selected.length > 0 && selected.length <= 100 && remaining === 0;

  function toggleGoal(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function confirmSelection() {
    if (!valid) return;
    onConfirm(selected.filter((item) => item.amount > 0).map(({ goal, amount }) => newSavingsExpenseWithdrawal(goal.id, amount)));
  }
  return <ActionSheet visible={funding !== null} onClose={onCancel}>
    {funding ? <Pressable onPress={() => {}} style={{ width: "100%" }}><BottomSheetSurface style={{ backgroundColor: v4.surface, maxHeight: "85%", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: v4Font, color: v4.ink, fontSize: 20, fontWeight: "700" }}>Use savings goal money?</Text>
        <Note>This expense uses {money(funding.unallocatedCentavos)} in unallocated money first. Choose which savings goals are affected by the remaining {money(funding.requiredWithdrawalCentavos)}.</Note>
        {funding?.existingShortfallCentavos > 0 ? <Banner tone="warn">{`Your goals already exceed this account's balance by ${money(funding.existingShortfallCentavos)}. Review their allocations.`}</Banner> : null}
        <Note>Select goals in the order you want to use them. The amount is calculated automatically.</Note>
        {funding?.goals.filter((goal) => goal.availableCentavos > 0).map((goal) => {
          const checked = selectedIds.includes(goal.id);
          const amount = selected.find((item) => item.goal.id === goal.id)?.amount ?? 0;
          return <Pressable key={goal.id} accessibilityRole="checkbox" accessibilityLabel={`Affect ${goal.name}`} accessibilityState={{ checked }} onPress={() => toggleGoal(goal.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: checked ? v4.brand : v4.hairline, backgroundColor: checked ? v4.infoBg : v4.surface }}>
            <View style={{ width: 20, height: 20, borderWidth: 1, borderRadius: 5, borderColor: checked ? v4.brand : v4.border, backgroundColor: checked ? v4.brand : v4.surface, alignItems: "center", justifyContent: "center" }}>
              {checked ? <Check size={14} color={v4.surface} weight="bold" /> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: v4Font, color: v4.ink, fontSize: 13, lineHeight: 18, fontWeight: "700" }}>{goal.name}</Text>
              <Text style={{ fontFamily: v4Font, color: v4.ink2, fontSize: 12, lineHeight: 16 }}>{money(goal.availableCentavos)} saved</Text>
              {checked ? <Text style={{ fontFamily: v4Font, color: v4.brand, fontSize: 12, lineHeight: 16 }}>{money(amount)} used · {money(goal.availableCentavos - amount)} remaining</Text> : null}
            </View>
          </Pressable>;
        })}
        {remaining > 0 ? <Note>Select goals to cover {money(remaining)} more.</Note> : null}
        <Note>Confirming saves this expense and reduces the selected goals by the amounts shown. Editing or deleting this expense updates those amounts.</Note>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid }} disabled={!valid} style={{ padding: 16, opacity: valid ? 1 : 0.4 }} onPress={confirmSelection}><Text style={{ fontFamily: v4Font, color: v4.brand, fontWeight: "700", textAlign: "center" }}>Confirm affected goals and save</Text></Pressable>
        <Pressable accessibilityRole="button" style={{ padding: 16 }} onPress={onCancel}><Text style={{ fontFamily: v4Font, color: v4.ink, textAlign: "center" }}>Cancel</Text></Pressable>
      </ScrollView>
    </BottomSheetSurface></Pressable> : null}
  </ActionSheet>;
}
