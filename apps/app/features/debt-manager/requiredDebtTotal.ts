import type { CreditCardCycle, CreditCardCycleTransaction } from "../../local-db/repositories/creditCardCycles";
import type { CreditCardPayment } from "../../local-db/repositories/creditCardPayments";
import type { CreditCardStrategy } from "../../local-db/repositories/creditCardRepaymentPlans";
import { statementPaymentTargetCentavos } from "../../local-db/repositories/creditCardRepaymentPlans";
import type { CreditCardStatement } from "../../local-db/repositories/creditCardStatements";
import type { DebtAccount } from "../../local-db/repositories/debtAccounts";
import type { DebtPayment } from "../../local-db/repositories/debtPayments";
import type { FinancialAccount } from "../../local-db/repositories/financialFoundations";
import { addPaymentPeriod } from "./debtForecast";

export type RequiredDebtObligationKind = "credit_card_statement" | "non_credit_card";

export type RequiredDebtObligation = {
  accountId: string;
  kind: RequiredDebtObligationKind;
  scheduledDueDates: string[];
  configuredTargetCentavos: number;
  recordedAmountCentavos: number;
  remainingRequiredCentavos: number;
  isEstimated?: boolean;
};

export type RequiredDebtTotal = {
  totalRequiredCentavos: number;
  obligations: RequiredDebtObligation[];
};

export type RequiredDebtTotalInput = {
  periodStart: string;
  periodEnd: string;
  debts: DebtAccount[];
  creditCards: FinancialAccount[];
  creditCardCycles: CreditCardCycle[];
  creditCardCycleTransactions: CreditCardCycleTransaction[];
  creditCardStatements: CreditCardStatement[];
  creditCardStrategies: CreditCardStrategy[];
  creditCardPayments: CreditCardPayment[];
  debtPayments: DebtPayment[];
};

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validatePeriod(periodStart: string, periodEnd: string) {
  if (!isIsoDate(periodStart) || !isIsoDate(periodEnd)) {
    throw new Error("periodStart and periodEnd must use valid YYYY-MM-DD dates");
  }
  if (periodStart > periodEnd) {
    throw new Error("periodStart must be on or before periodEnd");
  }
}

function getCreditCardObligations({
  periodEnd,
  creditCards,
  creditCardCycles,
  creditCardStatements,
  creditCardStrategies,
  creditCardPayments,
}: RequiredDebtTotalInput): RequiredDebtObligation[] {
  const activeCardIds = new Set(
    creditCards.filter((card) => card.kind === "credit_card" && card.status === "active").map((card) => card.id),
  );
  const cyclesById = new Map(
    creditCardCycles
      .filter((cycle) => !cycle.deleted && activeCardIds.has(cycle.account_id))
      .map((cycle) => [cycle.id, cycle]),
  );

  return creditCardStatements
    .filter((statement) => {
      const cycle = cyclesById.get(statement.cycle_id);
      return statement.authoritative
        && !statement.deleted
        && statement.due_date <= periodEnd
        && cycle?.user_id === statement.user_id;
    })
    .sort((left, right) => left.due_date.localeCompare(right.due_date) || left.id.localeCompare(right.id))
    .flatMap((statement) => {
      const cycle = cyclesById.get(statement.cycle_id)!;
      const strategy = creditCardStrategies.find((item) => item.accountId === cycle.account_id);
      const configuredTargetCentavos = statementPaymentTargetCentavos(statement, strategy) ?? statement.statement_balance_centavos;
      const recordedAmountCentavos = creditCardPayments
        .filter((payment) => (
          !payment.deleted
          && payment.user_id === statement.user_id
          && payment.cycle_id === statement.cycle_id
          && payment.statement_id === statement.id
          && payment.payment_date <= periodEnd
        ))
        .reduce((total, payment) => total + payment.amount_centavos, 0);

      const remainingRequiredCentavos = Math.max(0, configuredTargetCentavos - recordedAmountCentavos);
      return remainingRequiredCentavos > 0 ? [{
        accountId: cycle.account_id,
        kind: "credit_card_statement" as const,
        scheduledDueDates: [statement.due_date],
        configuredTargetCentavos,
        recordedAmountCentavos,
        remainingRequiredCentavos,
      }] : [];
    });
}

function getEstimatedCreditCardObligations({
  periodStart,
  periodEnd,
  creditCards,
  creditCardCycles,
  creditCardCycleTransactions,
  creditCardStatements,
  creditCardStrategies,
}: RequiredDebtTotalInput): RequiredDebtObligation[] {
  const activeCardIds = new Set(
    creditCards.filter((card) => card.kind === "credit_card" && card.status === "active").map((card) => card.id),
  );

  return creditCardCycles
    .filter((cycle) => (
      !cycle.deleted
      && activeCardIds.has(cycle.account_id)
      && cycle.cutoff_date >= periodStart
      && cycle.cutoff_date <= periodEnd
      && !creditCardStatements.some((statement) => (
        statement.cycle_id === cycle.id && statement.authoritative && !statement.deleted
      ))
    ))
    .sort((left, right) => left.cutoff_date.localeCompare(right.cutoff_date) || left.id.localeCompare(right.id))
    .flatMap((cycle) => {
      const estimatedBalanceCentavos = creditCardCycleTransactions
        .filter((transaction) => transaction.cycle_id === cycle.id && transaction.transaction_date <= cycle.cutoff_date)
        .reduce((total, transaction) => total + transaction.amount_centavos, 0);
      if (estimatedBalanceCentavos <= 0) return [];

      const strategy = creditCardStrategies.find((item) => item.accountId === cycle.account_id);
      // Before the issuer statement exists, the current cycle balance is the only
      // conservative minimum that can support every saved repayment strategy.
      const configuredTargetCentavos = statementPaymentTargetCentavos({
        statement_balance_centavos: estimatedBalanceCentavos,
        minimum_due_centavos: estimatedBalanceCentavos,
      }, strategy) ?? estimatedBalanceCentavos;
      return [{
        accountId: cycle.account_id,
        kind: "credit_card_statement" as const,
        scheduledDueDates: [cycle.cutoff_date],
        configuredTargetCentavos,
        recordedAmountCentavos: 0,
        remainingRequiredCentavos: configuredTargetCentavos,
        isEstimated: true,
      }];
    });
}

function getNonCreditCardObligations({ periodStart, periodEnd, debts, debtPayments }: RequiredDebtTotalInput): RequiredDebtObligation[] {
  return debts.flatMap((debt) => {
    if (
      debt.status !== "active"
      || debt.currentBalanceCentavos <= 0
      || debt.minimumPaymentCentavos <= 0
      || !debt.nextDueDate
      || (debt.paymentFrequency === "custom" && !debt.paymentSchedule.customIntervalDays)
    ) return [];

    let dueDate = debt.nextDueDate;
    while (dueDate < periodStart) {
      const nextDueDate = addPaymentPeriod(dueDate, debt.paymentFrequency, debt.paymentSchedule);
      if (!nextDueDate) return [];
      dueDate = nextDueDate;
    }

    const scheduledDueDates: string[] = [];
    let remainingBalanceCentavos = debt.currentBalanceCentavos;
    let configuredTargetCentavos = 0;
    while (dueDate <= periodEnd && remainingBalanceCentavos > 0) {
      const paymentCentavos = Math.min(debt.minimumPaymentCentavos, remainingBalanceCentavos);
      scheduledDueDates.push(dueDate);
      configuredTargetCentavos += paymentCentavos;
      remainingBalanceCentavos -= paymentCentavos;
      const nextDueDate = addPaymentPeriod(dueDate, debt.paymentFrequency, debt.paymentSchedule);
      if (!nextDueDate) break;
      dueDate = nextDueDate;
    }

    const recordedAmountCentavos = debtPayments
      .filter((payment) => payment.debt_account_id === debt.id && payment.payment_date >= periodStart && payment.payment_date <= periodEnd)
      .reduce((total, payment) => total + payment.amount_centavos, 0);
    const remainingRequiredCentavos = Math.max(0, configuredTargetCentavos - recordedAmountCentavos);
    return scheduledDueDates.length === 0 || remainingRequiredCentavos === 0
      ? []
      : [{
          accountId: debt.id,
          kind: "non_credit_card" as const,
          scheduledDueDates,
          configuredTargetCentavos,
          recordedAmountCentavos,
          remainingRequiredCentavos,
        }];
  });
}

export function getRequiredDebtTotal(input: RequiredDebtTotalInput): RequiredDebtTotal {
  validatePeriod(input.periodStart, input.periodEnd);
  const obligations = [
    ...getCreditCardObligations(input),
    ...getEstimatedCreditCardObligations(input),
    ...getNonCreditCardObligations(input),
  ];

  return {
    totalRequiredCentavos: obligations.reduce((total, obligation) => total + obligation.remainingRequiredCentavos, 0),
    obligations,
  };
}
