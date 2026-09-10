import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { listDebtAccounts, type DebtAccount } from "../../local-db/repositories/debtAccounts";
import { listDebtPayments, type DebtPayment } from "../../local-db/repositories/debtPayments";
import NonCreditDebtCard from "./NonCreditDebtCard";
import NonCreditDebtForecastSection from "./NonCreditDebtForecastSection";
import NonCreditDebtForm from "./NonCreditDebtForm";

type Props = { userId: string; deviceId: string; debtId: string; onBack: () => void; onRecordPayment: (debtId: string) => void; onEditPayment: (payment: DebtPayment) => void };

export default function NonCreditDebtDetailScreen({ userId, deviceId, debtId, onBack, onRecordPayment, onEditPayment }: Props) {
  const [debt, setDebt] = useState<DebtAccount | null | undefined>(undefined);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [editing, setEditing] = useState(false);
  async function load() {
    const debts = await listDebtAccounts(userId, "all");
    const nextDebt = debts.find((item) => item.id === debtId) ?? null;
    setDebt(nextDebt);
    setPayments(nextDebt ? await listDebtPayments(userId, debtId) : []);
  }
  useEffect(() => { load().catch(() => setDebt(null)); }, [debtId, userId]);
  if (debt === undefined) return <ActivityIndicator color="#013220" />;
  if (debt === null) return <View><Text style={{ fontFamily: "Manrope", color: "#B42318" }}>This debt is unavailable.</Text><Pressable accessibilityRole="button" accessibilityLabel="Back to Non Credit Card Debts" onPress={onBack} style={{ marginTop: 12 }}><Text style={{ color: "#013220", fontWeight: "700" }}>Back to debts</Text></Pressable></View>;
  if (editing) return <NonCreditDebtForm userId={userId} deviceId={deviceId} debt={debt} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); load().catch(() => {}); }} />;
  return <View><Pressable accessibilityRole="button" accessibilityLabel="Back to Non Credit Card Debts" onPress={onBack}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#6B7A6F" }}>Back</Text></Pressable><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A", marginTop: 12 }}>Non Credit Card Debts</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 3 }}>{debt.name}</Text><View style={{ marginTop: 16 }}><NonCreditDebtCard userId={userId} deviceId={deviceId} debt={debt} onEdit={() => setEditing(true)} onRecordPayment={onRecordPayment} onEditPayment={onEditPayment} onChanged={() => load().catch(() => {})} /><NonCreditDebtForecastSection debt={debt} payments={payments} /></View></View>;
}
