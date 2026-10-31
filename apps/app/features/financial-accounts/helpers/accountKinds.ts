import type { FinancialAccountKind } from "../../../local-db/repositories/foundations/financialFoundations";

export const ACCOUNT_KINDS: readonly FinancialAccountKind[] = [
  "cash", "bank", "e_wallet", "credit_card", "other",
];

export const KIND_LABELS: Record<FinancialAccountKind, string> = {
  cash: "Cash", bank: "Bank", e_wallet: "E-Wallet",
  savings: "Savings", credit_card: "Credit Card", other: "Other",
};
