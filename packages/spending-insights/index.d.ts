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
};

export type SpendingRecurrence = "one_time" | "frequent" | "yearly";

export function detectUnusualSpendings(transactions: SpendingTransaction[], recurrences?: ReadonlyMap<string, SpendingRecurrence | null>): UnusualSpendingInsight[];
export const UNUSUAL_SPENDING_MODEL_VERSION: string;
