export type SpendingTransaction = {
  id: string;
  transactionDate: string;
  amountCentavos: number;
  subcategoryId: string;
  subcategoryLabel: string;
  accountName: string | null;
};

export type UnusualSpendingInsight = {
  transactionId: string;
  amountCentavos: number;
  subcategoryLabel: string;
  accountName: string | null;
  transactionDate: string;
  usualSpendingCentavos: number;
  lowerBoundCentavos: number;
  upperBoundCentavos: number;
  severity: number;
  usableHistoryCount: number;
  subcategoryId: string;
  confirmedRecurring: boolean;
  // The user's answer to the unusual-spending question; null until they answer.
  recurrence: SpendingRecurrence | null;
  // The calendar months (1-12) a yearly answer comes back in; null for its own month.
  recurrenceMonths: number[] | null;
};

export type SpendingRecurrence = "one_time" | "frequent" | "yearly";

export function detectUnusualSpendings(transactions: SpendingTransaction[], recurrences?: ReadonlyMap<string, SpendingRecurrence | null>, recurrenceMonths?: ReadonlyMap<string, readonly number[]>): UnusualSpendingInsight[];
export function detectRecurringPayments<T extends SpendingTransaction>(transactions: T[], recurrences?: ReadonlyMap<string, SpendingRecurrence | null>, recurrenceMonths?: ReadonlyMap<string, readonly number[]>): Array<T & { months: number[] | null }>;
export const UNUSUAL_SPENDING_MODEL_VERSION: string;
