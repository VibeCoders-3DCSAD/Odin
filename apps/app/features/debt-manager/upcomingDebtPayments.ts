import { getRequiredDebtTotal, type RequiredDebtTotalInput } from "./requiredDebtTotal";

export type UpcomingDebtPayment = {
  id: string;
  name: string;
  kind: "credit_card_statement" | "non_credit_card";
  dueDate: string;
  remainingCentavos: number;
};

export function buildUpcomingDebtPayments(input: RequiredDebtTotalInput, asOfDate: string): UpcomingDebtPayment[] {
  const debtPayments = input.debtPayments.filter((payment) => payment.payment_date <= asOfDate);
  const principalPaidByDebt = new Map<string, number>();
  for (const payment of debtPayments) {
    if (payment.payment_date < input.periodStart || payment.payment_date > input.periodEnd) continue;
    principalPaidByDebt.set(payment.debt_account_id, (principalPaidByDebt.get(payment.debt_account_id) ?? 0) + payment.principal_centavos);
  }
  const debtsById = new Map(input.debts.map((debt) => [debt.id, debt]));
  const cardsById = new Map(input.creditCards.map((card) => [card.id, card]));
  const { obligations } = getRequiredDebtTotal({
    ...input,
    // The current balance already reflects payments. Restore this month's principal
    // before calculating the schedule so a partial final payment isn't counted twice.
    debts: input.debts.map((debt) => ({ ...debt, currentBalanceCentavos: debt.currentBalanceCentavos + (principalPaidByDebt.get(debt.id) ?? 0) })),
    debtPayments,
    creditCardPayments: input.creditCardPayments.filter((payment) => payment.payment_date <= asOfDate),
    creditCardStatements: input.creditCardStatements.filter((statement) => statement.due_date >= input.periodStart && statement.statement_date <= asOfDate),
    // A cycle cutoff is not a payment due date; only issued statements belong here.
    creditCardCycleTransactions: [],
  });

  return obligations.flatMap((obligation, obligationIndex) => {
    const debt = debtsById.get(obligation.accountId);
    const name = obligation.kind === "non_credit_card" ? debt?.name : cardsById.get(obligation.accountId)?.name;
    if (!name || obligation.isEstimated) return [];
    let paidCentavos = obligation.recordedAmountCentavos;
    let scheduledCentavos = obligation.configuredTargetCentavos;
    let remainingBalance = obligation.kind === "non_credit_card" ? debt!.currentBalanceCentavos : obligation.remainingRequiredCentavos;
    return obligation.scheduledDueDates.flatMap((dueDate) => {
      const target = obligation.kind === "non_credit_card" ? Math.min(debt!.minimumPaymentCentavos, scheduledCentavos) : scheduledCentavos;
      scheduledCentavos -= target;
      const appliedPayment = Math.min(target, paidCentavos);
      paidCentavos -= appliedPayment;
      const remainingCentavos = Math.min(remainingBalance, target - appliedPayment);
      remainingBalance -= remainingCentavos;
      return remainingCentavos > 0 ? [{ id: `${obligation.kind}:${obligation.accountId}:${dueDate}:${obligationIndex}`, name, kind: obligation.kind, dueDate, remainingCentavos }] : [];
    });
  }).sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.name.localeCompare(right.name));
}
