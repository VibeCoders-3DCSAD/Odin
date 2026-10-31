import { useEffect, useState } from "react";
import { getCreditCardPurchaseMetadataForTransaction } from "../../../local-db/repositories/creditCardInstallments";
import type { FinancialAccount } from "../../../local-db/repositories/financialFoundations";
import type { Transaction } from "../../../local-db/repositories/ledger";
import type { InstallmentFieldErrors, InstallmentFormValue } from "../components/CreditCardInstallmentFields";
import type { TransactionType } from "../components/TransactionTypeSelector";
import { emptyInstallment, installmentFromMetadata } from "../helpers/installmentForm";

type Options = {
  userId: string;
  transaction?: Transaction;
  txType: TransactionType;
  accounts: FinancialAccount[];
  sourceAccountId: string;
  amount: string;
};

// Credit-card expense details: posting date and the regular/installment split. An installment loaded
// for an edit is read-only, since amortizations may already be linked to billing cycles.
export function useCreditCardPurchase({ userId, transaction, txType, accounts, sourceAccountId, amount }: Options) {
  const isEdit = !!transaction;
  const [postingDate, setPostingDate] = useState(transaction?.credit_card_posting_date ?? "");
  const [creditCardPurchaseType, setCreditCardPurchaseType] = useState<"regular" | "installment">("regular");
  const [editInstallmentLocked, setEditInstallmentLocked] = useState(false);
  const [installment, setInstallment] = useState<InstallmentFormValue>(emptyInstallment);
  const [installmentErrors, setInstallmentErrors] = useState<InstallmentFieldErrors>({});
  const isCreditCardExpense = txType === "expense" && accounts.some((account) => account.id === sourceAccountId && account.kind === "credit_card");

  useEffect(() => {
    let active = true;
    if (!isEdit || transaction?.transaction_type !== "expense") return () => { active = false; };
    getCreditCardPurchaseMetadataForTransaction(userId, transaction.id)
      .then((metadata) => {
        if (!active) return;
        if (!metadata) {
          setCreditCardPurchaseType("regular");
          setEditInstallmentLocked(false);
          return;
        }
        setCreditCardPurchaseType(metadata.purchase_type);
        setEditInstallmentLocked(metadata.purchase_type === "installment");
        if (metadata.installment) setInstallment(installmentFromMetadata(metadata.installment));
      })
      .catch((error) => {
        console.error("[ledger] failed to load credit-card purchase metadata", {
          transactionId: transaction.id,
          error: error instanceof Error ? error.message : "unknown error",
        });
      });
    return () => { active = false; };
  }, [isEdit, transaction?.id, transaction?.transaction_type, userId]);

  // A new installment's original principal follows the amount, and so does the remaining principal until edited.
  useEffect(() => {
    if (isEdit || !isCreditCardExpense || creditCardPurchaseType !== "installment") return;
    const nextOriginalPrincipal = amount.trim();
    setInstallment((current) => {
      const shouldDefaultRemainingPrincipal = !current.remainingPrincipal.trim() || current.remainingPrincipal === current.originalPrincipal;
      const nextRemainingPrincipal = shouldDefaultRemainingPrincipal ? nextOriginalPrincipal : current.remainingPrincipal;
      if (current.originalPrincipal === nextOriginalPrincipal && current.remainingPrincipal === nextRemainingPrincipal) return current;
      return { ...current, originalPrincipal: nextOriginalPrincipal, remainingPrincipal: nextRemainingPrincipal };
    });
    // accounts, sourceAccountId and txType stay listed so a re-pick of the card re-runs the default.
  }, [accounts, amount, creditCardPurchaseType, isCreditCardExpense, isEdit, sourceAccountId, txType]);

  // Clears the edited field's error, and keeps remaining months on the term until they are edited.
  function changeInstallment(next: InstallmentFormValue) {
    const changed = (Object.keys(next) as (keyof InstallmentFormValue)[]).find((key) => next[key] !== installment[key]);
    if (changed) setInstallmentErrors((current) => ({ ...current, [changed]: undefined }));
    if (changed === "termMonths" && (!installment.remainingMonths.trim() || installment.remainingMonths === installment.termMonths)) {
      setInstallment({ ...next, remainingMonths: next.termMonths });
    } else {
      setInstallment(next);
    }
  }

  function reset() {
    setPostingDate("");
    setCreditCardPurchaseType("regular");
    setInstallment(emptyInstallment());
    setInstallmentErrors({});
  }

  return {
    isCreditCardExpense, postingDate, setPostingDate, creditCardPurchaseType, setCreditCardPurchaseType,
    editInstallmentLocked, installment, installmentErrors, setInstallmentErrors, changeInstallment, reset,
  };
}

export type CreditCardPurchase = ReturnType<typeof useCreditCardPurchase>;
