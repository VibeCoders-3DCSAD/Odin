export type RecurringPayment = {
  // Payments with the same key replace each other's months, newest first; a subcategory ID.
  key: string;
  transactionDate: string;
  amountCentavos: number;
  // Calendar months (1-12) the payment comes back in; null for its own month.
  months: readonly number[] | null;
};

export type ResolvedRecurringPayment<T extends RecurringPayment = RecurringPayment> = T & { months: number[] };

export function normalizeRecurrenceMonths(months: unknown): number[] | null;
export function resolveRecurringPayments<T extends RecurringPayment>(payments: readonly T[]): ResolvedRecurringPayment<T>[];
export function recurringMonthSpend(resolved: readonly ResolvedRecurringPayment[], targetMonth: string): number;
