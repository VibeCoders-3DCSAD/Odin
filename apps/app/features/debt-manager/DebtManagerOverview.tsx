import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { listFinancialAccounts, type FinancialAccount } from "../../local-db/repositories/financialFoundations";
import { listDebtAccounts, type DebtAccount } from "../../local-db/repositories/debtAccounts";
import { listAllDebtPayments, type DebtPayment } from "../../local-db/repositories/debtPayments";
import { listCreditCardCycles, listCreditCardCycleTransactions, type CreditCardCycle, type CreditCardCycleTransaction } from "../../local-db/repositories/creditCardCycles";
import { listCreditCardStatements, type CreditCardStatement } from "../../local-db/repositories/creditCardStatements";
import { listCreditCardPayments, type CreditCardPayment } from "../../local-db/repositories/creditCardPayments";
import { listCreditCardInstallments, type CreditCardInstallment } from "../../local-db/repositories/creditCardInstallments";
import { listCreditCardStrategies, type CreditCardStrategy } from "../../local-db/repositories/creditCardRepaymentPlans";
import { buildCreditCardForecast } from "./creditCardForecast";
import GlobalDebtTrend, { type GlobalDebtPoint } from "./GlobalDebtTrend";
import { buildDebtForecast } from "./debtForecast";
import { combineDebtBalanceSeries } from "./globalDebtForecast";

type Props = { userId: string; onOpenCreditCards: () => void; onOpenNonCreditDebts: () => void };

const P = { shell: "#fcf8f0", brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6" } as const;
export default function DebtManagerOverview({ userId, onOpenCreditCards, onOpenNonCreditDebts }: Props) {
  const [cards, setCards] = useState<FinancialAccount[] | null>(null);
  const [cycles, setCycles] = useState<CreditCardCycle[]>([]);
  const [transactions, setTransactions] = useState<CreditCardCycleTransaction[]>([]);
  const [statements, setStatements] = useState<CreditCardStatement[]>([]);
  const [payments, setPayments] = useState<CreditCardPayment[]>([]);
  const [installments, setInstallments] = useState<CreditCardInstallment[]>([]);
  const [strategies, setStrategies] = useState<CreditCardStrategy[]>([]);
  const [trendDebts, setTrendDebts] = useState<DebtAccount[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const globalTrend = useMemo<GlobalDebtPoint[]>(() => {
    const activeCards = cards ?? [];
    const asOfDate = new Date().toISOString().slice(0, 10);
    const cardSeries = activeCards.map((card) => ({ points: buildCreditCardForecast({ cycles: cycles.filter((cycle) => cycle.account_id === card.id), transactions: transactions.filter((transaction) => transaction.account_id === card.id), statements, strategy: strategies.find((strategy) => strategy.accountId === card.id), payments, installments: installments.filter((installment) => installment.account_id === card.id), availableCreditCentavos: card.creditCardDetails?.availableCreditCentavos ?? 0, creditLimitCentavos: card.creditCardDetails?.creditLimitCentavos ?? 0, asOfDate }).points.map((point) => ({ date: point.date, balanceCentavos: Math.max(0, (card.creditCardDetails?.creditLimitCentavos ?? 0) - point.availableCreditCentavos) })) }));
    const debtSeries = trendDebts.map((debt) => ({ points: buildDebtForecast(debt, asOfDate, debtPayments.filter((payment) => payment.debt_account_id === debt.id).map((payment) => ({ paymentDate: payment.payment_date, amountCentavos: payment.amount_centavos }))).points }));
    return combineDebtBalanceSeries([...cardSeries, ...debtSeries]).map((point) => ({ date: point.date, debtCentavos: point.balanceCentavos }));
  }, [cards, cycles, debtPayments, installments, payments, strategies, statements, transactions, trendDebts]);

  async function load() { const [accounts, activeDebts, finishedDebts, cycleRows, transactionRows, statementRows, paymentRows, installmentRows, strategyRows, allDebtPayments] = await Promise.all([listFinancialAccounts(userId), listDebtAccounts(userId, "active"), listDebtAccounts(userId, "finished"), listCreditCardCycles(userId), listCreditCardCycleTransactions(userId), listCreditCardStatements(userId), listCreditCardPayments(userId), listCreditCardInstallments(userId), listCreditCardStrategies(userId), listAllDebtPayments(userId)]); setCards(accounts.filter((account) => account.kind === "credit_card" && account.status === "active")); setTrendDebts([...activeDebts, ...finishedDebts]); setDebtPayments(allDebtPayments); setCycles(cycleRows); setTransactions(transactionRows); setStatements(statementRows); setPayments(paymentRows); setInstallments(installmentRows); setStrategies(strategyRows); }
  useEffect(() => { load().catch(() => { setCards([]); }); }, [userId]);

  if (cards === null) return <ActivityIndicator color={P.brand} />;

  return <View>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: P.ink }}>Debt Manager</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>Review your total debt and payment commitments</Text>
    <GlobalDebtTrend points={globalTrend} />
    <Pressable accessibilityRole="button" accessibilityLabel="Open Credit Cards" onPress={onOpenCreditCards} style={{ marginTop: 16, borderWidth: 1, borderColor: P.line, borderRadius: 16, padding: 16, backgroundColor: P.shell }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink }}>Credit Cards</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 4 }}>{cards.length === 0 ? "Add a credit card to begin tracking billing cycles." : `${cards.length} active ${cards.length === 1 ? "card" : "cards"}, organized by billing cycle.`}</Text>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.brand, marginTop: 12 }}>Manage credit cards</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Open Non Credit Card Debts" onPress={onOpenNonCreditDebts} style={{ marginTop: 16, borderWidth: 1, borderColor: P.line, borderRadius: 16, padding: 16, backgroundColor: P.shell }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink }}>Non Credit Card Debts</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 4 }}>Manage loans and other debts, including your repayment strategy.</Text>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.brand, marginTop: 12 }}>Manage non-credit-card debts</Text>
    </Pressable>
  </View>;
}
