import React from "react";
import { Pressable, Text, View } from "react-native";
import type { DebtAccount } from "../../local-db/repositories/debtAccounts";
import { getDebtTypeLabel } from "./debtTypes";

function money(value: number) { return `PHP ${(value / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`; }
export default function NonCreditDebtList({ debts, selectedDebtId, onSelectDebt }: { debts: DebtAccount[]; selectedDebtId: string | null; onSelectDebt: (debt: DebtAccount) => void }) {
  return <View style={{ marginTop: 18, gap: 10 }}>
    <Text style={{ fontWeight: "800", fontSize: 16 }}>Non-credit-card debts</Text>
    {debts.length === 0 ? <Text>No debts are recorded yet. Add a debt to track repayment progress.</Text> : debts.map((debt) => <Pressable key={debt.id} accessibilityRole="button" onPress={() => onSelectDebt(debt)} style={{ borderWidth: 1, borderColor: selectedDebtId === debt.id ? "#013220" : "#EAEAE6", borderRadius: 14, padding: 14 }}>
      <Text style={{ fontWeight: "800" }}>{debt.name}</Text><Text>{getDebtTypeLabel(debt.type)} · {debt.lenderName ?? "No lender"}</Text>
      <Text>Remaining balance: {money(debt.currentBalanceCentavos)}</Text><Text style={{ fontWeight: "700" }}>{debt.hasPaymentHistory ? debt.progress.replace("_", " ") : "No payments recorded yet."}</Text>
    </Pressable>)}
  </View>;
}
