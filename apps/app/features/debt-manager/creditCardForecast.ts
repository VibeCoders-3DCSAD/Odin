import type { CreditCardCycle, CreditCardCycleTransaction } from "../../local-db/repositories/creditCardCycles";
import type { CreditCardInstallment } from "../../local-db/repositories/creditCardInstallments";
import type { CreditCardPayment } from "../../local-db/repositories/creditCardPayments";
import { statementPaymentTargetCentavos, type CreditCardStatementStrategy } from "../../local-db/repositories/creditCardRepaymentPlans";
import type { CreditCardStatement } from "../../local-db/repositories/creditCardStatements";

export type CreditCardForecastPoint = { cycleId: string; date: string; availableCreditCentavos: number; targetCentavos: number };
export type CreditCardScheduleStatus = "ahead" | "on_schedule" | "behind";

type Input = {
  cycles: CreditCardCycle[];
  transactions: CreditCardCycleTransaction[];
  statements: CreditCardStatement[];
  strategies: CreditCardStatementStrategy[];
  payments: CreditCardPayment[];
  installments: CreditCardInstallment[];
  availableCreditCentavos: number;
  creditLimitCentavos: number;
  asOfDate: string;
};

function clampAvailableCredit(value: number, limit: number): number {
  return Math.max(0, Math.min(limit, value));
}

function addMonths(isoDate: string, months: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildCreditCardForecast({ cycles, transactions, statements, strategies, payments, installments, availableCreditCentavos, creditLimitCentavos, asOfDate }: Input): { points: CreditCardForecastPoint[]; status: CreditCardScheduleStatus } {
  const strategyByStatement = new Map(strategies.map((strategy) => [strategy.statementId, strategy]));
  const movementByDate = new Map<string, number>();
  for (const transaction of transactions) movementByDate.set(transaction.transaction_date, (movementByDate.get(transaction.transaction_date) ?? 0) - transaction.amount_centavos);
  for (const payment of payments) movementByDate.set(payment.payment_date, (movementByDate.get(payment.payment_date) ?? 0) + payment.amount_centavos);

  const movements = [...movementByDate.entries()].sort(([left], [right]) => left.localeCompare(right));
  let available = clampAvailableCredit(availableCreditCentavos - movements.reduce((sum, [, amount]) => sum + amount, 0), creditLimitCentavos);
  const points = movements.map(([date, amount], index) => {
    available = clampAvailableCredit(available + amount, creditLimitCentavos);
    return { cycleId: `history-${index}`, date, availableCreditCentavos: available, targetCentavos: 0 };
  });

  let expectedThroughToday = 0;
  let recordedThroughToday = 0;
  const latestStatement = statements.slice().sort((left, right) => right.due_date.localeCompare(left.due_date))[0];
  const target = latestStatement ? statementPaymentTargetCentavos(latestStatement, strategyByStatement.get(latestStatement.id)) ?? 0 : 0;
  if (latestStatement && latestStatement.due_date <= asOfDate) {
    expectedThroughToday = target;
    recordedThroughToday = payments.filter((payment) => payment.statement_id === latestStatement.id && payment.payment_date <= asOfDate).reduce((sum, payment) => sum + payment.amount_centavos, 0);
  }

  const forecastMonths = Math.max(0, ...installments.map((installment) => installment.remaining_months));
  const anchorDate = points.at(-1)?.date ?? cycles.slice().sort((left, right) => right.cutoff_date.localeCompare(left.cutoff_date))[0]?.cutoff_date;
  if (anchorDate && (target > 0 || forecastMonths > 0)) {
    let projectedAvailable = availableCreditCentavos;
    for (let month = 1; month <= forecastMonths + 1; month++) {
      const installmentPayment = installments.reduce(
        (sum, installment) => sum + (month <= installment.remaining_months ? installment.monthly_amortization_centavos : 0),
        0,
      );
      const projectedPayment = (month === 1 ? target : 0) + installmentPayment;
      projectedAvailable = clampAvailableCredit(projectedAvailable + projectedPayment, creditLimitCentavos);
      points.push({ cycleId: `forecast-${month}`, date: addMonths(anchorDate, month), availableCreditCentavos: projectedAvailable, targetCentavos: projectedPayment });
    }
  }
  const status: CreditCardScheduleStatus = recordedThroughToday > expectedThroughToday ? "ahead" : recordedThroughToday < expectedThroughToday ? "behind" : "on_schedule";
  return { points, status };
}
