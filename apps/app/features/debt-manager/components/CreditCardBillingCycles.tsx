import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import {
  createCreditCardCycle,
  recordCreditCardPayment,
  recordCreditCardStatement,
  listCreditCardCycles,
  listCreditCardCycleTransactions,
  listCreditCards,
  type CreditCard,
  type CreditCardCycle,
  type CreditCardCycleTransaction,
} from "../../../local-db/repositories/creditCards";

type Props = { userId: string; deviceId: string; onSyncRequested?: () => Promise<void> };
type Draft = { cycle_start_date: string; cutoff_date: string; statement_date: string };

const EMPTY_DRAFT: Draft = { cycle_start_date: "", cutoff_date: "", statement_date: "" };
const palette = { ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", card: "#F7EED9", brand: "#013220", green: "#0E6D46", red: "#D9001F" } as const;

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function formatRange(cycle: CreditCardCycle): string {
  return `${formatDate(cycle.cycleStartDate)} - ${formatDate(cycle.cutoffDate)}`;
}

function formatMoney(value: number): string {
  return `PHP ${(value / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

function CycleTransactions({ transactions }: { transactions: CreditCardCycleTransaction[] }) {
  if (transactions.length === 0) return <Text style={{ color: palette.muted, fontSize: 12 }}>No transactions in this cycle.</Text>;
  return <View style={{ gap: 8 }}>{transactions.map((transaction) => <View key={transaction.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
    <View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontWeight: "700", fontSize: 13 }}>{transaction.merchant_name || transaction.counterparty_name || "Card transaction"}</Text><Text style={{ color: palette.muted, fontSize: 11 }}>{formatDate(transaction.transaction_date)} · {transaction.purchase_type}</Text></View>
    <Text style={{ color: palette.ink, fontWeight: "800", fontSize: 13 }}>{formatMoney(transaction.amount_centavos)}</Text>
  </View>)}</View>;
}

function CycleRow({ cycle, userId, deviceId, onChanged }: { cycle: CreditCardCycle; userId: string; deviceId: string; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [transactions, setTransactions] = useState<CreditCardCycleTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [statementBalance, setStatementBalance] = useState(cycle.statementBalanceMinor == null ? "" : String(cycle.statementBalanceMinor / 100));
  const [minimumDue, setMinimumDue] = useState(cycle.minimumDueMinor == null ? "" : String(cycle.minimumDueMinor / 100));
  const [financeCharge, setFinanceCharge] = useState(cycle.financeChargeMinor == null ? "" : String(cycle.financeChargeMinor / 100));
  const [dueDate, setDueDate] = useState(cycle.dueDate ?? "");
  const [statementSaving, setStatementSaving] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || transactions.length > 0) return;
    setLoading(true);
    try { setTransactions(await listCreditCardCycleTransactions(userId, cycle.id)); } finally { setLoading(false); }
  }

  async function saveStatement() {
    setStatementError(null);
    setStatementSaving(true);
    try {
      await recordCreditCardStatement(userId, deviceId, {
        cycleId: cycle.id,
        statementBalanceMinor: Math.round(Number(statementBalance) * 100),
        minimumDueMinor: Math.round(Number(minimumDue) * 100),
        financeChargeMinor: Math.round(Number(financeCharge || 0) * 100),
        dueDate,
      });
      await onChanged();
    } catch (value) {
      setStatementError(value instanceof Error ? value.message : "Statement could not be saved.");
    } finally { setStatementSaving(false); }
  }

  async function savePayment() {
    setPaymentError(null);
    setPaymentSaving(true);
    try {
      await recordCreditCardPayment(userId, deviceId, {
        cycleId: cycle.id,
        statementId: cycle.statementId,
        amountMinor: Math.round(Number(paymentAmount) * 100),
        paymentDate,
        sourceAccountId: null,
        subcategoryId: null,
        notes: paymentNotes.trim() || undefined,
      });
      setPaymentAmount("");
      setPaymentNotes("");
      await onChanged();
    } catch (value) {
      setPaymentError(value instanceof Error ? value.message : "Payment could not be saved.");
    } finally { setPaymentSaving(false); }
  }

  const statementDayReached = cycle.statementDate <= new Date().toISOString().slice(0, 10);

  return <View style={{ borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12, gap: 10 }}>
    <Pressable onPress={() => void toggle()} accessibilityRole="button" accessibilityLabel={`Billing cycle ${formatRange(cycle)}`}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><View><Text style={{ color: palette.ink, fontWeight: "800", fontSize: 14 }}>{formatRange(cycle)}</Text><Text style={{ color: palette.muted, fontSize: 11 }}>{open ? "Hide details" : "View transactions and other details"}</Text></View><Text style={{ color: palette.green, fontWeight: "800", fontSize: 18 }}>{open ? "−" : "+"}</Text></View>
    </Pressable>
    {open ? <View style={{ gap: 14, paddingLeft: 8 }}>
      <View style={{ gap: 8 }}><Text style={{ color: palette.green, fontWeight: "800", fontSize: 11, letterSpacing: 0.5 }}>TRANSACTIONS</Text>{loading ? <ActivityIndicator color={palette.green} /> : <CycleTransactions transactions={transactions} />}</View>
       <View style={{ gap: 5 }}><Text style={{ color: palette.green, fontWeight: "800", fontSize: 11, letterSpacing: 0.5 }}>OTHER DETAILS</Text><Text style={{ color: palette.muted, fontSize: 12 }}>Cycle: {formatDate(cycle.cycleStartDate)} through {formatDate(cycle.cutoffDate)}</Text><Text style={{ color: palette.muted, fontSize: 12 }}>Statement date: {formatDate(cycle.statementDate)}</Text><Text style={{ color: palette.muted, fontSize: 12 }}>Statement balance: {cycle.statementBalanceMinor == null ? "Not recorded" : formatMoney(cycle.statementBalanceMinor)}</Text><Text style={{ color: palette.muted, fontSize: 12 }}>Minimum due: {cycle.minimumDueMinor == null ? "Not recorded" : formatMoney(cycle.minimumDueMinor)}</Text><Text style={{ color: palette.muted, fontSize: 12 }}>Finance charges: {cycle.financeChargeMinor == null ? "Not recorded" : formatMoney(cycle.financeChargeMinor)}</Text><Text style={{ color: palette.muted, fontSize: 12 }}>Due date: {cycle.dueDate ? formatDate(cycle.dueDate) : "Not recorded"}</Text><Text style={{ color: palette.muted, fontSize: 12 }}>Payment status: {cycle.paymentStatus ?? "Not recorded"}</Text><Text style={{ color: palette.muted, fontSize: 12 }}>Credit balance: {formatMoney(cycle.creditBalanceMinor)}</Text></View>
       <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12 }}><Text style={{ color: palette.green, fontWeight: "800", fontSize: 11, letterSpacing: 0.5 }}>RECORD PAYMENT</Text><TextInput value={paymentAmount} onChangeText={setPaymentAmount} placeholder="Enter payment amount" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 11, backgroundColor: palette.card, color: palette.ink }} /><TextInput value={paymentDate} onChangeText={setPaymentDate} placeholder="Select payment date" placeholderTextColor={palette.muted} style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 11, backgroundColor: palette.card, color: palette.ink }} /><TextInput value={paymentNotes} onChangeText={setPaymentNotes} placeholder="Add payment notes" placeholderTextColor={palette.muted} style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 11, backgroundColor: palette.card, color: palette.ink }} />{paymentError ? <Text style={{ color: palette.red, fontSize: 12 }}>{paymentError}</Text> : null}<Pressable accessibilityRole="button" accessibilityLabel="Record payment" onPress={() => void savePayment()} disabled={paymentSaving} style={{ backgroundColor: palette.brand, borderRadius: 10, padding: 12, alignItems: "center", opacity: paymentSaving ? 0.6 : 1 }}><Text style={{ color: "#fff", fontWeight: "800" }}>{paymentSaving ? "Saving..." : "Record payment"}</Text></Pressable></View>
      {!cycle.statementId ? <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12 }}><Text style={{ color: palette.green, fontWeight: "800", fontSize: 11, letterSpacing: 0.5 }}>STATEMENT {statementDayReached ? "DUE" : "UPCOMING"}</Text><Text style={{ color: palette.muted, fontSize: 12 }}>{statementDayReached ? "Your statement should be available. Enter the bank-provided details below." : `Statement expected on ${formatDate(cycle.statementDate)}.`}</Text>{([ ["statementBalance", statementBalance, setStatementBalance, "Enter statement balance"], ["minimumDue", minimumDue, setMinimumDue, "Enter minimum amount due"], ["financeCharge", financeCharge, setFinanceCharge, "Enter finance charges or interest"], ["dueDate", dueDate, setDueDate, "Select due date"] ] as const).map(([key, value, setter, placeholder]) => <TextInput key={key} value={value} onChangeText={setter} placeholder={placeholder} placeholderTextColor={palette.muted} keyboardType={key === "dueDate" ? "default" : "decimal-pad"} style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 11, backgroundColor: palette.card, color: palette.ink }} />)}{statementError ? <Text style={{ color: palette.red, fontSize: 12 }}>{statementError}</Text> : null}<Pressable onPress={() => void saveStatement()} disabled={statementSaving} style={{ backgroundColor: palette.brand, borderRadius: 10, padding: 12, alignItems: "center", opacity: statementSaving ? 0.6 : 1 }}><Text style={{ color: "#fff", fontWeight: "800" }}>{statementSaving ? "Saving..." : "Save statement"}</Text></Pressable></View> : null}
    </View> : null}
  </View>;
}

function CardCycles({ card, userId, deviceId, onSyncRequested }: { card: CreditCard; userId: string; deviceId: string; onSyncRequested?: () => Promise<void> }) {
  const [cycles, setCycles] = useState<CreditCardCycle[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() { setCycles(await listCreditCardCycles(userId, card.accountId)); }
  useEffect(() => { void load(); }, [card.accountId, userId]);

  async function addCycle() {
    setError(null);
    setSaving(true);
    try {
      await createCreditCardCycle(userId, deviceId, { accountId: card.accountId, cycleStartDate: draft.cycle_start_date, cutoffDate: draft.cutoff_date, statementDate: draft.statement_date });
      setDraft(EMPTY_DRAFT); setShowForm(false); await load(); await onSyncRequested?.();
    } catch (value) { setError(value instanceof Error ? value.message : "Billing cycle could not be saved."); } finally { setSaving(false); }
  }

  return <View style={{ backgroundColor: "#FCF8F0", borderRadius: 18, padding: 16, gap: 14 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><View><Text style={{ color: palette.ink, fontWeight: "800", fontSize: 16 }}>{card.issuer || "Credit card"}</Text><Text style={{ color: palette.muted, fontSize: 12 }}>{formatMoney(card.availableCreditMinor ?? card.creditLimitMinor)} available</Text></View><Pressable onPress={() => setShowForm((value) => !value)} accessibilityRole="button" accessibilityLabel={`Add billing cycle for ${card.issuer || "credit card"}`}><Text style={{ color: palette.green, fontWeight: "800" }}>{showForm ? "Cancel" : "+ Cycle"}</Text></Pressable></View>
    {cycles.length === 0 ? <Text style={{ color: palette.muted, fontSize: 12 }}>No billing cycles yet. Add one to organize card transactions.</Text> : <View style={{ gap: 12 }}>{cycles.map((cycle) => <CycleRow key={cycle.id} cycle={cycle} userId={userId} deviceId={deviceId} onChanged={load} />)}</View>}
    {showForm ? <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12 }}><Text style={{ color: palette.green, fontWeight: "800", fontSize: 11, letterSpacing: 0.5 }}>ADD BILLING CYCLE</Text>{(["cycle_start_date", "cutoff_date", "statement_date"] as const).map((field) => <TextInput key={field} value={draft[field]} onChangeText={(value) => setDraft((current) => ({ ...current, [field]: value }))} placeholder={`${field.replaceAll("_", " ")} YYYY-MM-DD`} placeholderTextColor={palette.muted} style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 11, backgroundColor: palette.card, color: palette.ink }} />)}{error ? <Text style={{ color: palette.red, fontSize: 12 }}>{error}</Text> : null}<Pressable onPress={() => void addCycle()} disabled={saving} style={{ backgroundColor: palette.brand, borderRadius: 10, padding: 12, alignItems: "center", opacity: saving ? 0.6 : 1 }}><Text style={{ color: "#fff", fontWeight: "800" }}>{saving ? "Saving..." : "Save billing cycle"}</Text></Pressable></View> : null}
  </View>;
}

export function CreditCardBillingCycles({ userId, deviceId, onSyncRequested }: Props) {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { let active = true; listCreditCards(userId).then((value) => { if (active) setCards(value); }).catch((value) => { if (active) setError(value instanceof Error ? value.message : "Credit cards could not be loaded."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [userId]);

  if (loading) return <ActivityIndicator color={palette.green} />;
  if (error) return <Text style={{ color: palette.red }}>{error}</Text>;
  if (cards.length === 0) return null;
  return <View style={{ gap: 12 }}><Text style={{ color: palette.ink, fontWeight: "800", fontSize: 18 }}>Credit Cards</Text>{cards.map((card) => <CardCycles key={card.accountId} card={card} userId={userId} deviceId={deviceId} onSyncRequested={onSyncRequested} />)}</View>;
}
