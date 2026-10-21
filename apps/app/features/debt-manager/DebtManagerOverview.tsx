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
import DebtOverviewSummary from "./DebtOverviewSummary";
import DebtPaymentTrend from "./DebtPaymentTrend";
import GlobalDebtTrend, { type GlobalDebtPoint } from "./GlobalDebtTrend";
import { buildDebtForecast } from "./debtForecast";
import { buildDebtManagerSummary, type DebtManagerSummary } from "./debtManagerSummary";
import { currentDebtTrendWindow, getPhilippineToday } from "./debtTrendRange";
import { combineDebtBalanceSeries } from "./globalDebtForecast";
import { getAcceptedFinancialPlanForPeriod, getCurrentFinancialPlanPeriod, type AcceptedFinancialPlan } from "../../local-db/repositories/financialPlans";
import { getDebtStrategy, listDebtPriorities, type DebtPriority, type DebtStrategy } from "../../local-db/repositories/debtRepaymentPlans";
import { allocateDebtRepayments, type DebtRepaymentAllocation } from "./debtRepaymentAllocation";
import { getCreditCardPaymentRequirementCentavos } from "./creditCardPaymentRequirement";
import UpcomingPaymentsCard from "./UpcomingPaymentsCard";
import { buildUpcomingDebtPayments } from "./upcomingDebtPayments";

type Props = { userId: string; onOpenCreditCards: () => void; onOpenNonCreditDebts: () => void };
type SurplusRecommendation = { id: string; label: string; amountCentavos: number };

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
  const [financialPlan, setFinancialPlan] = useState<AcceptedFinancialPlan | null>(null);
  const [debtStrategy, setDebtStrategy] = useState<DebtStrategy>("avalanche");
  const [debtPriorities, setDebtPriorities] = useState<DebtPriority[]>([]);
  const today = getPhilippineToday();
  const upcomingPayments = useMemo(() => {
    const { start, end } = currentDebtTrendWindow("month", undefined, new Date(`${today}T00:00:00Z`));
    return buildUpcomingDebtPayments({ periodStart: start, periodEnd: end, debts: trendDebts, creditCards: cards ?? [], creditCardCycles: cycles, creditCardCycleTransactions: transactions, creditCardStatements: statements, creditCardStrategies: strategies, creditCardPayments: payments, debtPayments }, today);
  }, [today, cards, cycles, debtPayments, payments, statements, strategies, transactions, trendDebts]);
  const overview = useMemo<{ globalTrend: GlobalDebtPoint[]; summary: DebtManagerSummary; allocation: DebtRepaymentAllocation; surplusAllocation: DebtRepaymentAllocation; creditCardRequirementCentavos: number; surplusRecommendations: SurplusRecommendation[] }>(() => {
    const activeCards = cards ?? [];
    const asOfDate = getPhilippineToday();
    const cardForecasts = activeCards.map((card) => ({ card, forecast: buildCreditCardForecast({ cycles: cycles.filter((cycle) => cycle.account_id === card.id), transactions: transactions.filter((transaction) => transaction.account_id === card.id), statements, strategy: strategies.find((strategy) => strategy.accountId === card.id), payments, installments: installments.filter((installment) => installment.account_id === card.id), availableCreditCentavos: card.creditCardDetails?.availableCreditCentavos ?? 0, creditLimitCentavos: card.creditCardDetails?.creditLimitCentavos ?? 0, billingCycleEndDay: card.creditCardDetails?.cutoffDay ?? null, reconciledAvailableCreditCentavos: card.creditCardDetails?.reconciledAvailableCreditCentavos, preReconciliationAvailableCreditCentavos: card.creditCardDetails?.preReconciliationAvailableCreditCentavos, availableCreditReconciledAt: card.creditCardDetails?.availableCreditReconciledAt, asOfDate }) }));
    const creditCardRequirementCentavos = getCreditCardPaymentRequirementCentavos({ cards: activeCards, cycles, statements, payments, strategies, asOfDate });
    const debtReservations = ((financialPlan?.recommendation.debtReservations as Array<{ debtAccountId?: string | null; amountCentavos?: number }> | undefined) ?? []);
    const nonCreditDebtReservationCentavos = debtReservations.reduce((total, reservation) => total + (reservation.debtAccountId && typeof reservation.amountCentavos === "number" && Number.isSafeInteger(reservation.amountCentavos) ? Math.max(0, reservation.amountCentavos) : 0), 0);
    const planDebtSurplusCentavos = financialPlan?.recommendation.debtSurplusCentavos;
    const debtSurplusCentavos = typeof planDebtSurplusCentavos === "number" && Number.isSafeInteger(planDebtSurplusCentavos) ? Math.max(0, planDebtSurplusCentavos) : 0;
    const creditCardStatementCandidates = activeCards.flatMap((card) => {
      const cycleIds = new Set(cycles.filter((cycle) => cycle.account_id === card.id).map((cycle) => cycle.id));
      const statement = statements.filter((item) => item.authoritative && !item.deleted && cycleIds.has(item.cycle_id) && item.statement_date <= asOfDate).sort((left, right) => right.statement_date.localeCompare(left.statement_date))[0];
      if (!statement) return [];
      const paidCentavos = payments.filter((payment) => payment.statement_id === statement.id && payment.payment_date <= asOfDate).reduce((total, payment) => total + payment.amount_centavos, 0);
      const unpaidCentavos = Math.max(0, statement.statement_balance_centavos - paidCentavos);
      return unpaidCentavos > 0 ? [{ id: `statement:${statement.id}`, name: `${card.name} statement`, status: "active" as const, type: "custom_debt" as const, currentBalanceCentavos: unpaidCentavos, minimumPaymentCentavos: 0, annualInterestRateBps: 0, allowsExtraPayments: true }] : [];
    });
    const allocation = allocateDebtRepayments({ debts: trendDebts, debtBudgetCentavos: nonCreditDebtReservationCentavos, strategy: debtStrategy, priorities: debtPriorities });
    const surplusAllocation = allocateDebtRepayments({ debts: [...trendDebts, ...creditCardStatementCandidates], debtBudgetCentavos: debtSurplusCentavos, strategy: debtStrategy, priorities: debtPriorities, includeMinimumPayments: false });
    const surplusRecommendations = [...trendDebts, ...creditCardStatementCandidates].flatMap((debt) => {
      const recommendedCentavos = surplusAllocation.allocations.get(debt.id) ?? 0;
      return recommendedCentavos > 0 ? [{ id: debt.id, label: debt.name, amountCentavos: recommendedCentavos }] : [];
    });
    const debtForecasts = trendDebts.map((debt) => ({ debt, forecast: buildDebtForecast(debt, asOfDate, debtPayments.filter((payment) => payment.debt_account_id === debt.id).map((payment) => ({ paymentDate: payment.payment_date, amountCentavos: payment.amount_centavos })), allocation.allocations.get(debt.id)) }));
    const cardSeries = cardForecasts.map(({ card, forecast }) => ({ points: forecast.points.map((point) => ({ date: point.date, balanceCentavos: Math.max(0, (card.creditCardDetails?.creditLimitCentavos ?? 0) - point.availableCreditCentavos) })) }));
    const debtSeries = debtForecasts.map(({ forecast }) => ({ points: forecast.points }));
    const globalTrend = combineDebtBalanceSeries([...cardSeries, ...debtSeries]).map((point) => ({ date: point.date, debtCentavos: point.balanceCentavos }));
    const cardSummaryItems = cardForecasts.map(({ card, forecast }) => ({ currentDebtCentavos: Math.max(0, (card.creditCardDetails?.creditLimitCentavos ?? 0) - (card.creditCardDetails?.availableCreditCentavos ?? 0)), state: forecast.status === "on_schedule" ? "on_track" as const : forecast.status })).filter((item) => item.currentDebtCentavos > 0);
    const debtSummaryItems = debtForecasts.map(({ debt, forecast }) => ({ currentDebtCentavos: debt.currentBalanceCentavos, state: forecast.status }));
    const debtNameById = new Map(trendDebts.map((debt) => [debt.id, debt.name]));
    const accountNameById = new Map(activeCards.map((card) => [card.id, card.name]));
    const accountIdByCycleId = new Map(cycles.map((cycle) => [cycle.id, cycle.account_id]));
    const recordedPayments = [...debtPayments.map((payment) => ({ paymentDate: payment.payment_date, debtName: debtNameById.get(payment.debt_account_id) ?? "Debt", amountCentavos: payment.amount_centavos })), ...payments.map((payment) => ({ paymentDate: payment.payment_date, debtName: accountNameById.get(accountIdByCycleId.get(payment.cycle_id) ?? "") ?? "Credit card", amountCentavos: payment.amount_centavos }))];
    return { globalTrend, summary: buildDebtManagerSummary([...cardSummaryItems, ...debtSummaryItems], recordedPayments, asOfDate), allocation, surplusAllocation, creditCardRequirementCentavos, surplusRecommendations };
  }, [cards, cycles, debtPayments, debtPriorities, debtStrategy, financialPlan, installments, payments, strategies, statements, transactions, trendDebts]);

  async function load() { const today = getPhilippineToday(); const period = getCurrentFinancialPlanPeriod(today); const [accounts, activeDebts, finishedDebts, cycleRows, transactionRows, statementRows, paymentRows, installmentRows, strategyRows, allDebtPayments, plan, strategy, priorities] = await Promise.all([listFinancialAccounts(userId), listDebtAccounts(userId, "active"), listDebtAccounts(userId, "finished"), listCreditCardCycles(userId), listCreditCardCycleTransactions(userId), listCreditCardStatements(userId), listCreditCardPayments(userId), listCreditCardInstallments(userId), listCreditCardStrategies(userId), listAllDebtPayments(userId), getAcceptedFinancialPlanForPeriod(userId, period.start, period.end), getDebtStrategy(userId), listDebtPriorities(userId)]); setCards(accounts.filter((account) => account.kind === "credit_card" && account.status === "active")); setTrendDebts([...activeDebts, ...finishedDebts]); setDebtPayments(allDebtPayments); setCycles(cycleRows); setTransactions(transactionRows); setStatements(statementRows); setPayments(paymentRows); setInstallments(installmentRows); setStrategies(strategyRows); setFinancialPlan(plan); setDebtStrategy(strategy); setDebtPriorities(priorities); }
  useEffect(() => { load().catch(() => { setCards([]); }); }, [userId]);

  if (cards === null) return <ActivityIndicator color={P.brand} />;

  const financialPlanRepayments = Array.isArray(financialPlan?.recommendation.debtReservations)
    ? financialPlan.recommendation.debtReservations.flatMap((reservation) => {
      if (!reservation || typeof reservation !== "object") return [];
      const { debtAccountId, creditCardStatementId, amountCentavos, dueDate } = reservation as { debtAccountId?: unknown; creditCardStatementId?: unknown; amountCentavos?: unknown; dueDate?: unknown };
      if (typeof amountCentavos !== "number" || !Number.isSafeInteger(amountCentavos) || amountCentavos < 0) return [];
      const debt = typeof debtAccountId === "string" ? trendDebts.find((item) => item.id === debtAccountId) : undefined;
      const statement = typeof creditCardStatementId === "string" ? statements.find((item) => item.id === creditCardStatementId) : undefined;
      const account = statement ? cards.find((item) => item.id === cycles.find((cycle) => cycle.id === statement.cycle_id)?.account_id) : undefined;
      const label = debt?.name ?? (statement ? `${account?.name ?? "Credit card"} statement` : null);
      return label ? [{ id: typeof debtAccountId === "string" ? debtAccountId : creditCardStatementId as string, label, amountCentavos, dueDate: typeof dueDate === "string" ? dueDate : null }] : [];
    })
    : [];

  return <View>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: P.ink }}>Debt Manager</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>Review your total debt and payment commitments</Text>
    <DebtOverviewSummary summary={overview.summary} />
    <UpcomingPaymentsCard payments={upcomingPayments} today={today} />
    <View style={{ backgroundColor: P.shell, borderColor: P.line, borderRadius: 14, borderWidth: 1, gap: 3, marginTop: 14, padding: 14 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 14, fontWeight: "800" }}>{debtStrategy === "snowball" ? "Snowball" : "Avalanche"} repayment plan</Text>{financialPlan ? <><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Credit-card statement targets: PHP {(overview.creditCardRequirementCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Required non-credit payments: PHP {(overview.allocation.requiredPaymentCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>{overview.allocation.shortfallCentavos > 0 ? `Financial Plan shortfall: PHP ${(overview.allocation.shortfallCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : `Strategy surplus: PHP ${(overview.surplusAllocation.surplusCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}</Text>{overview.surplusRecommendations.length ? <View style={{ borderTopColor: P.line, borderTopWidth: 1, gap: 3, marginTop: 8, paddingTop: 8 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Recommended surplus allocation</Text>{overview.surplusRecommendations.map((recommendation) => <Text key={recommendation.id} style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>{recommendation.label}: PHP {(recommendation.amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</Text>)}</View> : null}{financialPlanRepayments.length ? <View style={{ borderTopColor: P.line, borderTopWidth: 1, gap: 3, marginTop: 8, paddingTop: 8 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Financial Plan repayments</Text>{financialPlanRepayments.map((repayment) => <Text key={repayment.id} style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>{repayment.label}: PHP {(repayment.amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}{repayment.dueDate ? ` due ${repayment.dueDate}` : ""}</Text>)}</View> : null}</> : <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Accept a Financial Plan for this month to calculate allocation and surplus.</Text>}</View>
    <DebtPaymentTrend points={overview.summary.paymentTrend} />
    <GlobalDebtTrend points={overview.globalTrend} />
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
