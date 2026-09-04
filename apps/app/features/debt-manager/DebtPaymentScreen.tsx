import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { createDebtPayment, getDebt, listDebtPayments, type Debt, type DebtPayment } from "../../local-db/repositories/debts";
import { money, today } from "./formatters";

type Props = { userId: string; deviceId: string; debtId: string; onBack: () => void; onSaved: () => void; onRecordTransaction?: (paymentId?: string) => void; onSyncRequested?: () => Promise<void> };

export default function DebtPaymentScreen({ userId, deviceId, debtId, onBack, onSaved, onRecordTransaction, onSyncRequested }: Props) {
  const [debt, setDebt] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [amount, setAmount] = useState(""); const [principal, setPrincipal] = useState(""); const [interest, setInterest] = useState(""); const [date, setDate] = useState(today()); const [notes, setNotes] = useState(""); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);

  async function load() { const nextDebt = await getDebt(userId, debtId); setDebt(nextDebt); setPayments(await listDebtPayments(userId, debtId)); }
  useEffect(() => { void load(); }, [userId, debtId]);

  async function save() {
    if (!debt) return; setError(null); setSaving(true);
    try { const parse = (value: string) => Math.round(Number(value || 0) * 100); await createDebtPayment(userId, deviceId, debtId, { amountMinor: parse(amount), paymentDate: date, principalMinor: parse(principal || amount), interestMinor: interest ? parse(interest) : undefined, notes: notes.trim() || undefined }); if (onSyncRequested) await onSyncRequested().catch(() => {}); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Payment could not be saved."); } finally { setSaving(false); }
  }

  if (!debt) return <Text>Debt not found.</Text>;
  return <View style={{ gap: 12 }}><Pressable onPress={onBack}><Text>Debt Manager</Text></Pressable><Text style={{ fontSize: 20, fontWeight: "800" }}>Record payment: {debt.name}</Text><Text>Remaining balance: {money(debt.currentBalanceMinor)}</Text>{error ? <Text style={{ color: "#D9001F" }}>{error}</Text> : null}<TextInput accessibilityLabel="Payment amount" value={amount} onChangeText={setAmount} placeholder="Enter payment amount" keyboardType="decimal-pad" /><TextInput accessibilityLabel="Payment date" value={date} onChangeText={setDate} placeholder="Select payment date" /><TextInput accessibilityLabel="Principal amount" value={principal} onChangeText={setPrincipal} placeholder="Enter principal amount" keyboardType="decimal-pad" /><TextInput accessibilityLabel="Interest amount" value={interest} onChangeText={setInterest} placeholder="Enter interest or fee amount" keyboardType="decimal-pad" /><TextInput accessibilityLabel="Payment notes" value={notes} onChangeText={setNotes} placeholder="Add payment notes" /><Pressable disabled={saving} onPress={() => void save()}><Text>{saving ? "Saving..." : "Save payment"}</Text></Pressable><Pressable onPress={() => onRecordTransaction?.()}><Text>Record a related transaction instead</Text></Pressable><Text style={{ fontSize: 18, fontWeight: "700" }}>Payment history</Text>{payments.length === 0 ? <Text>No payments recorded yet.</Text> : payments.map((payment) => <View key={payment.id}><Text>{payment.paymentDate} · {money(payment.amountMinor)}</Text><Text>{payment.source === "manual" ? "Standalone payment" : "Linked transaction"}</Text>{payment.source === "manual" ? <Pressable onPress={() => onRecordTransaction?.(payment.id)}><Text>Record a related transaction</Text></Pressable> : null}</View>)}</View>;
}
