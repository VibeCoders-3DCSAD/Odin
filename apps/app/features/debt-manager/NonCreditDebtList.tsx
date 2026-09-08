import React from "react";
import { Text, View } from "react-native";
import type { DebtAccount } from "../../local-db/repositories/debtAccounts";
import type { DebtPayment } from "../../local-db/repositories/debtPayments";
import { getDebtTypeLabel } from "./debtTypes";
import NonCreditDebtCard from "./NonCreditDebtCard";

type Props = { userId: string; deviceId: string; debts: DebtAccount[]; onEdit: (debt: DebtAccount) => void; onRecordPayment: (debtId: string) => void; onEditPayment: (payment: DebtPayment) => void; onChanged: () => void };

export default function NonCreditDebtList({ userId, deviceId, debts, onEdit, onRecordPayment, onEditPayment, onChanged }: Props) {
  const groups = debts.reduce<Record<string, DebtAccount[]>>((result, debt) => { const category = getDebtTypeLabel(debt.type); (result[category] ??= []).push(debt); return result; }, {});
  return <View style={{ marginTop: 22, gap: 18 }}>
    <View><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 17, color: "#1B1C1A" }}>Your debts</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 3 }}>Grouped by category, with recent payment activity</Text></View>
    {debts.length === 0 ? <Text style={{ fontFamily: "Manrope", color: "#6B7A6F" }}>No debts are recorded yet. Add a debt to track repayment progress.</Text> : Object.entries(groups).map(([category, categoryDebts]) => <View key={category} style={{ gap: 10 }}><Text style={{ fontFamily: "Manrope", fontSize: 12, fontWeight: "800", color: "#6B7A6F", textTransform: "uppercase", letterSpacing: 0.8 }}>{category} · {categoryDebts.length}</Text>{categoryDebts.map((debt) => <NonCreditDebtCard key={debt.id} userId={userId} deviceId={deviceId} debt={debt} onEdit={onEdit} onRecordPayment={onRecordPayment} onEditPayment={onEditPayment} onChanged={onChanged} />)}</View>)}
  </View>;
}
