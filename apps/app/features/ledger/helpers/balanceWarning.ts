import type { FinancialAccount } from "../../../local-db/repositories/financialFoundations";
import type { Transaction } from "../../../local-db/repositories/ledger";

export type BalanceWarning = {
  accountName: string;
  deficitCentavos: number;
  isCreditCard: boolean;
};

// Flags a save that would push the paying account below zero. An edit adds its own original amount
// back first, since that money is already counted against the account.
export function getBalanceWarning(
  accounts: FinancialAccount[],
  accountId: string,
  amountCentavos: number,
  transaction?: Transaction,
): BalanceWarning | null {
  const account = accounts.find((item) => item.id === accountId);
  if (!account) return null;

  const isCreditCard = account.kind === "credit_card" && account.creditCardDetails;
  let availableCentavos = isCreditCard
    ? account.creditCardDetails!.availableCreditCentavos ?? account.creditCardDetails!.creditLimitCentavos
    : account.currentBalanceCentavos;

  if (
    transaction
    && transaction.source_account_id === account.id
    && (transaction.transaction_type === "expense" || transaction.transaction_type === "transfer")
  ) {
    availableCentavos += transaction.amount_centavos;
  }

  const remainingCentavos = availableCentavos - amountCentavos;
  return remainingCentavos < 0
    ? { accountName: account.name, deficitCentavos: Math.abs(remainingCentavos), isCreditCard: Boolean(isCreditCard) }
    : null;
}
