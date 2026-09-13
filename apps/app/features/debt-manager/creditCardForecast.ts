import type { CreditCardCycle, CreditCardCycleTransaction } from "../../local-db/repositories/creditCardCycles";
import type { CreditCardInstallment } from "../../local-db/repositories/creditCardInstallments";
import type { CreditCardPayment } from "../../local-db/repositories/creditCardPayments";
import type { CreditCardStrategy } from "../../local-db/repositories/creditCardRepaymentPlans";
import type { CreditCardStatement } from "../../local-db/repositories/creditCardStatements";

export type CreditCardForecastPoint = {
  cycleId: string;
  date: string;
  availableCreditCentavos: number;
  targetCentavos: number;
  regularPaymentCentavos?: number;
  amortizationPaymentCentavos?: number;
};
export type CreditCardScheduleStatus = "ahead" | "on_schedule" | "behind";

export type CreditCardForecastInput = {
  cycles: CreditCardCycle[];
  transactions: CreditCardCycleTransaction[];
  statements: CreditCardStatement[];
  strategy?: CreditCardStrategy;
  payments: CreditCardPayment[];
  installments: CreditCardInstallment[];
  availableCreditCentavos: number;
  creditLimitCentavos: number;
  billingCycleDays: number | null;
  asOfDate: string;
};

type CreditCardForecast = { points: CreditCardForecastPoint[]; status: CreditCardScheduleStatus };
const YIELD_INTERVAL = 50;

function clampAvailableCredit(value: number, limit: number): number {
  return Math.max(0, Math.min(limit, value));
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function paymentTargetForNode(balanceCentavos: number, minimumDueCentavos: number, strategy?: CreditCardStrategy, percentagePaymentCentavos?: number): number {
  if (!strategy || balanceCentavos <= 0) return 0;
  if (strategy.strategy === "pay_in_full") return balanceCentavos;
  if (strategy.strategy === "pay_minimum") return Math.min(balanceCentavos, minimumDueCentavos);
  if (strategy.strategy === "percentage_of_statement" && strategy.percentageBps !== null) {
    return Math.min(balanceCentavos, percentagePaymentCentavos ?? Math.max(1, Math.round(balanceCentavos * strategy.percentageBps / 10_000)));
  }
  return Math.min(balanceCentavos, strategy.customAmountCentavos ?? 0);
}

function paymentComponentsForNode(regularBalanceCentavos: number, amortizationCentavos: number, minimumDueCentavos: number, strategy?: CreditCardStrategy, percentagePaymentCentavos?: number) {
  if (!strategy) return { regularPaymentCentavos: 0, amortizationPaymentCentavos: amortizationCentavos };
  return {
    regularPaymentCentavos: paymentTargetForNode(regularBalanceCentavos, minimumDueCentavos, strategy, percentagePaymentCentavos),
    amortizationPaymentCentavos: amortizationCentavos,
  };
}

function* calculateCreditCardForecast({ cycles, transactions, statements, strategy, payments, installments, availableCreditCentavos, creditLimitCentavos, billingCycleDays, asOfDate }: CreditCardForecastInput): Generator<void, CreditCardForecast, undefined> {
  const cycleIds = new Set(cycles.map((cycle) => cycle.id));
  const cardTransactions: CreditCardCycleTransaction[] = [];
  for (let index = 0; index < transactions.length; index += 1) {
    if (cycleIds.has(transactions[index]!.cycle_id)) cardTransactions.push(transactions[index]!);
    if (index % YIELD_INTERVAL === 0) yield;
  }
  const cardStatements: CreditCardStatement[] = [];
  for (let index = 0; index < statements.length; index += 1) {
    if (cycleIds.has(statements[index]!.cycle_id)) cardStatements.push(statements[index]!);
    if (index % YIELD_INTERVAL === 0) yield;
  }
  const statementIds = new Set(cardStatements.map((statement) => statement.id));
  const cardPayments: CreditCardPayment[] = [];
  for (let index = 0; index < payments.length; index += 1) {
    if (statementIds.has(payments[index]!.statement_id)) cardPayments.push(payments[index]!);
    if (index % YIELD_INTERVAL === 0) yield;
  }
  const movementByDate = new Map<string, number>();
  for (let index = 0; index < cardTransactions.length; index += 1) {
    const transaction = cardTransactions[index]!;
    if (transaction.transaction_date <= asOfDate) movementByDate.set(transaction.transaction_date, (movementByDate.get(transaction.transaction_date) ?? 0) - transaction.amount_centavos);
    if (index % YIELD_INTERVAL === 0) yield;
  }
  for (let index = 0; index < cardPayments.length; index += 1) {
    const payment = cardPayments[index]!;
    if (payment.payment_date <= asOfDate) movementByDate.set(payment.payment_date, (movementByDate.get(payment.payment_date) ?? 0) + payment.amount_centavos);
    if (index % YIELD_INTERVAL === 0) yield;
  }

  const movements = [...movementByDate.entries()].sort(([left], [right]) => left.localeCompare(right));
  let movementTotal = 0;
  for (let index = 0; index < movements.length; index += 1) {
    movementTotal += movements[index]![1];
    if (index % YIELD_INTERVAL === 0) yield;
  }
  let available = clampAvailableCredit(availableCreditCentavos - movementTotal, creditLimitCentavos);
  const points: CreditCardForecastPoint[] = [];
  for (let index = 0; index < movements.length; index += 1) {
    const [date, amount] = movements[index]!;
    available = clampAvailableCredit(available + amount, creditLimitCentavos);
    points.push({ cycleId: `history-${index}`, date, availableCreditCentavos: available, targetCentavos: 0 });
    if (index % YIELD_INTERVAL === 0) yield;
  }
  const forecastAvailableCredit = points.at(-1)?.availableCreditCentavos ?? availableCreditCentavos;
  if (!points.some((point) => point.date === asOfDate)) {
    points.push({ cycleId: "current", date: asOfDate, availableCreditCentavos: forecastAvailableCredit, targetCentavos: 0 });
  }

  let expectedThroughToday = 0;
  let recordedThroughToday = 0;
  let latestStatement: CreditCardStatement | undefined;
  for (let index = 0; index < cardStatements.length; index += 1) {
    const statement = cardStatements[index]!;
    if (statement.authoritative && !statement.deleted && statement.statement_date <= asOfDate && (!latestStatement || statement.statement_date > latestStatement.statement_date)) latestStatement = statement;
    if (index % YIELD_INTERVAL === 0) yield;
  }
  const target = latestStatement ? paymentTargetForNode(latestStatement.statement_balance_centavos, latestStatement.minimum_due_centavos, strategy) : 0;
  let recordedForLatestStatement = 0;
  for (let index = 0; index < cardPayments.length; index += 1) {
    const payment = cardPayments[index]!;
    if (payment.statement_id === latestStatement?.id && payment.payment_date <= asOfDate) recordedForLatestStatement += payment.amount_centavos;
    if (index % YIELD_INTERVAL === 0) yield;
  }
  if (latestStatement && latestStatement.due_date <= asOfDate) {
    expectedThroughToday = target;
    recordedThroughToday = recordedForLatestStatement;
  }

  let forecastMonths = 0;
  for (let index = 0; index < installments.length; index += 1) {
    forecastMonths = Math.max(forecastMonths, installments[index]!.remaining_months);
    if (index % YIELD_INTERVAL === 0) yield;
  }
  const anchorDate = latestStatement?.due_date ?? points.at(-1)?.date ?? cycles.slice().sort((left, right) => right.cutoff_date.localeCompare(left.cutoff_date))[0]?.cutoff_date;
  if (anchorDate && billingCycleDays && (target > 0 || forecastMonths > 0)) {
    const currentDebt = Math.max(0, creditLimitCentavos - forecastAvailableCredit);
    let regularPurchases = 0;
    let statementInstallments = 0;
    for (let index = 0; index < cardTransactions.length; index += 1) {
      const transaction = cardTransactions[index]!;
      if (transaction.purchase_type === "regular") regularPurchases += transaction.amount_centavos;
      if (transaction.cycle_id === latestStatement?.cycle_id && transaction.purchase_type === "installment") statementInstallments += transaction.amount_centavos;
      if (index % YIELD_INTERVAL === 0) yield;
    }
    const regularSource = regularPurchases > 0
      ? regularPurchases
      : Math.max(0, (latestStatement?.statement_balance_centavos ?? currentDebt) - statementInstallments);
    let regularBalance = Math.min(currentDebt, Math.max(0, regularSource - recordedForLatestStatement));
    let installmentBalance = currentDebt - regularBalance;
    let firstForecastMonth = recordedForLatestStatement > 0 ? 1 : 0;
    while (addDays(anchorDate, firstForecastMonth * billingCycleDays) < asOfDate) firstForecastMonth += 1;
    const lastInstallmentMonth = firstForecastMonth + forecastMonths - 1;
    for (let month = firstForecastMonth; month <= lastInstallmentMonth || regularBalance > 0; month++) {
      if (month - firstForecastMonth >= 600) break;
      const installmentOrdinal = month - firstForecastMonth + 1;
      let scheduledAmortization = 0;
      for (let index = 0; index < installments.length; index += 1) {
        const installment = installments[index]!;
        if (installmentOrdinal <= installment.remaining_months) scheduledAmortization += installment.monthly_amortization_centavos;
        if (index % YIELD_INTERVAL === 0) yield;
      }
      const amortizationDue = Math.min(installmentBalance, scheduledAmortization);
      const components = month === 0 && latestStatement && latestStatement.due_date < asOfDate
        ? { regularPaymentCentavos: 0, amortizationPaymentCentavos: 0 }
        : paymentComponentsForNode(regularBalance, amortizationDue, latestStatement?.minimum_due_centavos ?? 0, strategy, strategy?.strategy === "percentage_of_statement" ? target : undefined);
      regularBalance -= components.regularPaymentCentavos;
      installmentBalance -= components.amortizationPaymentCentavos;
      const projectedPayment = components.regularPaymentCentavos + components.amortizationPaymentCentavos;
      points.push({
        cycleId: `forecast-${month}`,
        date: addDays(anchorDate, month * billingCycleDays),
        availableCreditCentavos: clampAvailableCredit(creditLimitCentavos - regularBalance - installmentBalance, creditLimitCentavos),
        targetCentavos: projectedPayment,
        ...components,
      });
      if (month >= lastInstallmentMonth && projectedPayment === 0) break;
      if (month % YIELD_INTERVAL === 0) yield;
    }
  }
  const status: CreditCardScheduleStatus = recordedThroughToday > expectedThroughToday ? "ahead" : recordedThroughToday < expectedThroughToday ? "behind" : "on_schedule";
  return { points, status };
}

export function buildCreditCardForecast(input: CreditCardForecastInput): CreditCardForecast {
  const calculation = calculateCreditCardForecast(input);
  let next = calculation.next();
  while (!next.done) next = calculation.next();
  return next.value;
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function buildCreditCardForecastAsync(input: CreditCardForecastInput): Promise<CreditCardForecast> {
  const calculation = calculateCreditCardForecast(input);
  let next = calculation.next();
  while (!next.done) {
    await yieldToUi();
    next = calculation.next();
  }
  return next.value;
}
