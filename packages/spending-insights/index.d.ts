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
};

export function detectUnusualSpendings(transactions: SpendingTransaction[], confirmedRecurringIds?: ReadonlySet<string>): UnusualSpendingInsight[];
export const UNUSUAL_SPENDING_MODEL_VERSION: string;
