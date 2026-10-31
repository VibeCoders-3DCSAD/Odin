import type { UnusualSpendingInsight } from "../../../local-db/repositories/alerts/unusualSpending";

export type RecurringPaymentGroup = {
  key: string;
  payment: UnusualSpendingInsight;
  months: number[];
  transactionIds: string[];
};

/** Combine matching answers while preserving each underlying transaction. */
export function groupRecurringPayments(insights: readonly UnusualSpendingInsight[]): RecurringPaymentGroup[] {
  const groups = new Map<string, RecurringPaymentGroup>();
  const newestFirst = [...insights].sort((left, right) => right.transactionDate.localeCompare(left.transactionDate));
  for (const payment of newestFirst) {
    if (payment.recurrence !== "yearly") continue;
    const months = [...(payment.recurrenceMonths ?? [Number(payment.transactionDate.slice(5, 7))])].sort((a, b) => a - b);
    const key = JSON.stringify([payment.subcategoryId, payment.amountCentavos, months]);
    const group = groups.get(key);
    if (group) {
      if (!group.transactionIds.includes(payment.transactionId)) group.transactionIds.push(payment.transactionId);
    } else {
      groups.set(key, { key, payment, months, transactionIds: [payment.transactionId] });
    }
  }
  return [...groups.values()];
}
