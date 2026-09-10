import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { listFinancialAccounts, type FinancialAccount } from "../../local-db/repositories/financialFoundations";
import { listDebtAccounts, type DebtAccount, type DebtListVisibility } from "../../local-db/repositories/debtAccounts";
import { listAllDebtPayments, type DebtPayment } from "../../local-db/repositories/debtPayments";
import NonCreditDebtForm from "./NonCreditDebtForm";
import NonCreditDebtList from "./NonCreditDebtList";
import { getDebtStrategy, saveDebtStrategy, type DebtStrategy } from "../../local-db/repositories/debtRepaymentPlans";
import { listCreditCardCycles, listCreditCardCycleTransactions, type CreditCardCycle, type CreditCardCycleTransaction } from "../../local-db/repositories/creditCardCycles";
import { listCreditCardStatements, type CreditCardStatement } from "../../local-db/repositories/creditCardStatements";
import { listCreditCardPayments, type CreditCardPayment } from "../../local-db/repositories/creditCardPayments";
import { listCreditCardInstallments, type CreditCardInstallment } from "../../local-db/repositories/creditCardInstallments";
import { listCreditCardStatementStrategies, type CreditCardStatementStrategy } from "../../local-db/repositories/creditCardRepaymentPlans";
import { buildCreditCardForecast } from "./creditCardForecast";
import GlobalDebtTrend, { type GlobalDebtPoint } from "./GlobalDebtTrend";
import { PAYMENT_INTERVAL_DAYS } from "./debtForecast";

type Props = { userId: string; deviceId: string; onOpenCreditCards: () => void; onRecordDebtPayment: (debtId: string) => void; onEditDebtPayment: (payment: DebtPayment) => void };

const P = { shell: "#fcf8f0", brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6" } as const;
const DEBT_VISIBILITY_LABELS = { active: "Active", finished: "Finished", archived: "Archived", deleted: "Deleted" } as const;

export default function DebtManagerOverview({ userId, deviceId, onOpenCreditCards, onRecordDebtPayment, onEditDebtPayment }: Props) {
  const [cards, setCards] = useState<FinancialAccount[] | null>(null);
  const [debts, setDebts] = useState<DebtAccount[] | null>(null);
  const [editingDebt, setEditingDebt] = useState<DebtAccount | null | undefined>(undefined);
  const [visibility, setVisibility] = useState<DebtListVisibility>("active");
  const [strategy, setStrategy] = useState<DebtStrategy>("avalanche");
  const [strategySaving, setStrategySaving] = useState(false);
  const [cycles, setCycles] = useState<CreditCardCycle[]>([]);
  const [transactions, setTransactions] = useState<CreditCardCycleTransaction[]>([]);
  const [statements, setStatements] = useState<CreditCardStatement[]>([]);
  const [payments, setPayments] = useState<CreditCardPayment[]>([]);
  const [installments, setInstallments] = useState<CreditCardInstallment[]>([]);
  const [statementStrategies, setStatementStrategies] = useState<CreditCardStatementStrategy[]>([]);
  const [trendDebts, setTrendDebts] = useState<DebtAccount[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const globalTrend = useMemo<GlobalDebtPoint[]>(() => {
    const activeCards = cards ?? [];
    const asOfDate = new Date().toISOString().slice(0, 10);
    const forecasts = activeCards.map((card) => ({ card, points: buildCreditCardForecast({ cycles: cycles.filter((cycle) => cycle.account_id === card.id), transactions: transactions.filter((transaction) => transaction.account_id === card.id), statements, strategies: statementStrategies, payments, installments: installments.filter((installment) => installment.account_id === card.id), availableCreditCentavos: card.creditCardDetails?.availableCreditCentavos ?? 0, creditLimitCentavos: card.creditCardDetails?.creditLimitCentavos ?? 0, asOfDate }).points }));
    const scheduledPayments = trendDebts.flatMap((debt) => {
      const interval = PAYMENT_INTERVAL_DAYS[debt.paymentFrequency];
      if (debt.status !== "active" || !debt.nextDueDate || !interval || debt.minimumPaymentCentavos <= 0) return [];
      const payments = [] as { debtId: string; date: string; amountCentavos: number }[];
      let date = debt.nextDueDate;
      let remaining = debt.currentBalanceCentavos;
      while (remaining > 0) {
        const amountCentavos = Math.min(remaining, debt.minimumPaymentCentavos);
        payments.push({ debtId: debt.id, date, amountCentavos });
        remaining -= amountCentavos;
        const next = new Date(`${date}T12:00:00`);
        next.setDate(next.getDate() + interval);
        date = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      }
      return payments;
    });
    const dates = [...new Set([...forecasts.flatMap(({ points }) => points.map((point) => point.date)), ...debtPayments.map((payment) => payment.payment_date), ...scheduledPayments.map((payment) => payment.date)])].sort();
    return dates.map((date) => ({ date, debtCentavos: trendDebts.reduce((sum, debt) => sum + Math.max(0, debt.currentBalanceCentavos + debtPayments.filter((payment) => payment.debt_account_id === debt.id && payment.payment_date > date).reduce((paymentSum, payment) => paymentSum + payment.amount_centavos, 0) - scheduledPayments.filter((payment) => payment.debtId === debt.id && payment.date <= date && payment.date >= asOfDate).reduce((paymentSum, payment) => paymentSum + payment.amountCentavos, 0)), 0) + forecasts.reduce((sum, { card, points }) => {
      const point = points.filter((item) => item.date <= date).at(-1) ?? points[0];
      return sum + Math.max(0, (card.creditCardDetails?.creditLimitCentavos ?? 0) - (point?.availableCreditCentavos ?? card.creditCardDetails?.availableCreditCentavos ?? 0));
    }, 0) }));
  }, [cards, cycles, debtPayments, installments, payments, statementStrategies, statements, transactions, trendDebts]);

  async function load() { const [accounts, debtRows, activeDebts, finishedDebts, repaymentStrategy, cycleRows, transactionRows, statementRows, paymentRows, installmentRows, strategyRows, allDebtPayments] = await Promise.all([listFinancialAccounts(userId), listDebtAccounts(userId, visibility), listDebtAccounts(userId, "active"), listDebtAccounts(userId, "finished"), getDebtStrategy(userId), listCreditCardCycles(userId), listCreditCardCycleTransactions(userId), listCreditCardStatements(userId), listCreditCardPayments(userId), listCreditCardInstallments(userId), listCreditCardStatementStrategies(userId), listAllDebtPayments(userId)]); setCards(accounts.filter((account) => account.kind === "credit_card" && account.status === "active")); setDebts(debtRows); setTrendDebts([...activeDebts, ...finishedDebts]); setDebtPayments(allDebtPayments); setStrategy(repaymentStrategy); setCycles(cycleRows); setTransactions(transactionRows); setStatements(statementRows); setPayments(paymentRows); setInstallments(installmentRows); setStatementStrategies(strategyRows); }
  useEffect(() => { load().catch(() => { setCards([]); setDebts([]); }); }, [userId, visibility]);

  if (cards === null || debts === null) return <ActivityIndicator color={P.brand} />;
  if (editingDebt !== undefined) return <NonCreditDebtForm userId={userId} deviceId={deviceId} debt={editingDebt} onCancel={() => setEditingDebt(undefined)} onSaved={() => { setEditingDebt(undefined); load().catch(() => {}); }} />;

  return <View>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: P.ink }}>Debt Manager</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>Review your debt accounts and payment commitments</Text>
    <GlobalDebtTrend points={globalTrend} />
    <View style={{ marginTop: 16, borderWidth: 1, borderColor: P.line, borderRadius: 14, padding: 14, backgroundColor: P.shell }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", color: P.ink }}>Repayment strategy</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>Apply surplus after required payments to active non-credit-card debts.</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>{(["snowball", "avalanche"] as const).map((option) => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: strategy === option, disabled: strategySaving }} disabled={strategySaving} onPress={() => { setStrategySaving(true); saveDebtStrategy(userId, deviceId, option).then(() => setStrategy(option)).finally(() => setStrategySaving(false)); }} style={{ borderWidth: 1, borderColor: strategy === option ? P.brand : P.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", color: strategy === option ? P.brand : P.ink }}>{option === "snowball" ? "Snowball" : "Avalanche"}</Text></Pressable>)}</View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Open Credit Cards" onPress={onOpenCreditCards} style={{ marginTop: 16, borderWidth: 1, borderColor: P.line, borderRadius: 16, padding: 16, backgroundColor: P.shell }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink }}>Credit Cards</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 4 }}>{cards.length === 0 ? "Add a credit card to begin tracking billing cycles." : `${cards.length} active ${cards.length === 1 ? "card" : "cards"}, organized by billing cycle.`}</Text>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.brand, marginTop: 12 }}>Manage credit cards</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Add non-credit-card debt" onPress={() => setEditingDebt(null)} style={{ marginTop: 16, backgroundColor: P.brand, borderRadius: 14, padding: 12 }}><Text style={{ color: "white", fontWeight: "800" }}>Add debt</Text></Pressable>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>{(["active", "finished", "archived", "deleted"] as const).map((status) => <Pressable key={status} accessibilityRole="button" accessibilityLabel={`Show ${status} debts`} onPress={() => setVisibility(status)} style={{ borderWidth: 1, borderColor: visibility === status ? P.brand : P.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: visibility === status ? P.shell : "transparent" }}><Text style={{ color: P.ink, fontWeight: "700" }}>{DEBT_VISIBILITY_LABELS[status]}</Text></Pressable>)}</View>
    <NonCreditDebtList userId={userId} deviceId={deviceId} debts={debts} onEdit={setEditingDebt} onRecordPayment={onRecordDebtPayment} onEditPayment={onEditDebtPayment} onChanged={() => load().catch(() => {})} />
  </View>;
}
