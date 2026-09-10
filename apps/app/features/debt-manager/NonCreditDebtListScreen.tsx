import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { listDebtAccounts, type DebtAccount, type DebtListVisibility } from "../../local-db/repositories/debtAccounts";
import { getDebtStrategy, saveDebtStrategy, type DebtStrategy } from "../../local-db/repositories/debtRepaymentPlans";
import NonCreditDebtForm from "./NonCreditDebtForm";
import { getDebtTypeLabel } from "./debtTypes";

type Props = { userId: string; deviceId: string; onBack: () => void; onOpenDebt: (debtId: string) => void };

const P = { shell: "#fcf8f0", brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6" } as const;
const FILTERS: { value: DebtListVisibility; label: string }[] = [{ value: "active", label: "Active" }, { value: "finished", label: "Finished" }, { value: "archived", label: "Archived" }, { value: "deleted", label: "Deleted" }];

export default function NonCreditDebtListScreen({ userId, deviceId, onBack, onOpenDebt }: Props) {
  const [debts, setDebts] = useState<DebtAccount[] | null>(null);
  const [visibility, setVisibility] = useState<DebtListVisibility>("active");
  const [strategy, setStrategy] = useState<DebtStrategy>("avalanche");
  const [savingStrategy, setSavingStrategy] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtAccount | null | undefined>(undefined);

  function load() { return Promise.all([listDebtAccounts(userId, visibility), getDebtStrategy(userId)]).then(([nextDebts, nextStrategy]) => { setDebts(nextDebts); setStrategy(nextStrategy); }); }
  useEffect(() => { load().catch(() => setDebts([])); }, [userId, visibility]);

  if (editingDebt !== undefined) return <NonCreditDebtForm userId={userId} deviceId={deviceId} debt={editingDebt} onCancel={() => setEditingDebt(undefined)} onSaved={() => { setEditingDebt(undefined); load().catch(() => {}); }} />;
  if (debts === null) return <ActivityIndicator color={P.brand} />;

  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Debt Manager" onPress={onBack}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.muted }}>Back</Text></Pressable>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: P.ink, marginTop: 12 }}>Non Credit Card Debts</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>Select a debt to view payments and repayment details.</Text>
    <View style={{ marginTop: 16, borderWidth: 1, borderColor: P.line, borderRadius: 14, padding: 14, backgroundColor: P.shell }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", color: P.ink }}>Global repayment strategy</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>Apply surplus after required payments to active non-credit-card debts.</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>{(["snowball", "avalanche"] as const).map((option) => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: strategy === option, disabled: savingStrategy }} disabled={savingStrategy} onPress={() => { setSavingStrategy(true); saveDebtStrategy(userId, deviceId, option).then(() => setStrategy(option)).finally(() => setSavingStrategy(false)); }} style={{ borderWidth: 1, borderColor: strategy === option ? P.brand : P.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", color: strategy === option ? P.brand : P.ink }}>{option === "snowball" ? "Snowball" : "Avalanche"}</Text></Pressable>)}</View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Add non-credit-card debt" onPress={() => setEditingDebt(null)} style={{ marginTop: 16, backgroundColor: P.brand, borderRadius: 14, padding: 12 }}><Text style={{ color: "white", fontWeight: "800" }}>Add debt</Text></Pressable>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>{FILTERS.map(({ value, label }) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Show ${value} debts`} onPress={() => setVisibility(value)} style={{ borderWidth: 1, borderColor: visibility === value ? P.brand : P.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: visibility === value ? P.shell : "transparent" }}><Text style={{ color: P.ink, fontWeight: "700" }}>{label}</Text></Pressable>)}</View>
    <View style={{ marginTop: 18, gap: 10 }}>{debts.length === 0 ? <Text style={{ fontFamily: "Manrope", color: P.muted }}>No {visibility === "finished" ? "finished" : visibility} debts are recorded yet.</Text> : debts.map((debt) => <Pressable key={debt.id} accessibilityRole="button" accessibilityLabel={`Open ${debt.name}`} onPress={() => onOpenDebt(debt.id)} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 16, padding: 14, backgroundColor: P.shell }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>{debt.name}</Text><Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 3 }}>{getDebtTypeLabel(debt.type)} | {debt.lenderName ?? "No lender listed"}</Text><Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 8 }}>Remaining: PHP {(debt.currentBalanceCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</Text></Pressable>)}</View>
  </View>;
}
