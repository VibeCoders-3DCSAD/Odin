import { useState } from "react";
import { useToast } from "../../../components/Toast";
import type { StatementPaymentContext } from "../../../local-db/repositories/creditCardPayments";
import type { CreateCreditCardInstallmentInput } from "../../../local-db/repositories/creditCardInstallments";
import type { FinancialAccount } from "../../../local-db/repositories/financialFoundations";
import type { Transaction } from "../../../local-db/repositories/ledger";
import type { DebtPaymentContext } from "../../../local-db/repositories/debtPayments";
import { getSavingsExpenseFunding, type SavingsExpenseFunding, type SavingsExpenseWithdrawal } from "../../../local-db/repositories/savingsExpenseFunding";
import type { UnusualSpendingInsight } from "../../../local-db/repositories/unusualSpending";
import { runSync } from "../../../local-db/sync/runSync";
import { getBalanceWarning, type BalanceWarning } from "../helpers/balanceWarning";
import { buildInstallmentInput } from "../helpers/installmentForm";
import { parseMoney, toDateKey } from "../helpers/transactionFormat";
import type { TransactionFormProps } from "../services/loadTransactionForm";
import { saveTransaction } from "../services/saveTransaction";
import type { CreditCardPurchase } from "./useCreditCardPurchase";
import type { DebtPaymentFields } from "./useDebtPaymentFields";
import type { TransactionFormFields } from "./useTransactionFormFields";
import type { useStatementPayment } from "./useStatementPayment";

type Options = {
  userId: string;
  deviceId: string;
  accessToken: string;
  onClose: () => void;
  onCreated?: (unusualSpending: UnusualSpendingInsight | null) => void;
  transaction?: Transaction;
  statementPaymentContext?: StatementPaymentContext;
  debtPaymentContext?: DebtPaymentContext;
  savingsActivityContext?: TransactionFormProps["savingsActivityContext"];
  accounts: FinancialAccount[];
  fields: TransactionFormFields;
  effectiveSubcategoryId: string;
  resetCategory: () => void;
  debt: DebtPaymentFields;
  statement: ReturnType<typeof useStatementPayment>;
  card: CreditCardPurchase;
};

// Validates the form, walks the balance-warning and savings-funding confirmations, then saves and syncs.
export function useTransactionSave(options: Options) {
  const { userId, deviceId, accessToken, onClose, onCreated, transaction, statementPaymentContext, debtPaymentContext, savingsActivityContext, accounts, fields, effectiveSubcategoryId, resetCategory, debt, statement, card } = options;
  const { showToast } = useToast();
  const isEdit = !!transaction;
  const [saving, setSaving] = useState(false);
  const [savingsFunding, setSavingsFunding] = useState<SavingsExpenseFunding | null>(null);
  const [balanceWarning, setBalanceWarning] = useState<BalanceWarning | null>(null);

  // Returns the first problem with the form, in the order the fields appear.
  function validate(centavos: number, principalCentavos: number, interestCentavos: number): string | null {
    const { txType, sourceAccountId, destAccountId, contributionGoalId } = fields;
    if (centavos <= 0) return "Enter a valid amount";
    if (txType === "expense" && !sourceAccountId) return "Select a source account";
    if (txType === "income" && !destAccountId) return "Select a destination account";
    if (fields.isSavingsContribution && txType === "transfer" && !contributionGoalId) return "Select a savings goal";
    if (txType === "transfer" && !savingsActivityContext) {
      if (!sourceAccountId) return "Select a source account";
      if (!contributionGoalId && !destAccountId) return "Select a destination account";
    }
    if (txType !== "transfer" && !effectiveSubcategoryId) return "Select a category";
    if (debt.isDebtPayment && !debt.debtPaymentId) return "Select a debt before continuing";
    if (debt.isDebtPayment && (principalCentavos < 0 || interestCentavos < 0 || principalCentavos + interestCentavos > centavos)) {
      return "Some payment details are not valid. Check the highlighted fields and try again.";
    }
    if (card.isCreditCardExpense && card.postingDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(card.postingDate.trim())) {
      return "Some credit-card details are not valid. Check the highlighted fields and try again.";
    }
    if (card.editInstallmentLocked) {
      return "Installment transactions cannot be edited after creation because amortizations and available-credit holds may already be linked to billing cycles.";
    }
    return null;
  }

  async function handleSave(confirmed = false, savingsWithdrawals?: SavingsExpenseWithdrawal[]) {
    if (saving) return;
    const phase = { current: "start" };
    fields.setFormError(null);
    const centavos = parseMoney(fields.amount);
    const principalCentavos = debt.isDebtPayment ? parseMoney(debt.debtPrincipal || fields.amount) : 0;
    const interestCentavos = debt.isDebtPayment ? parseMoney(debt.debtInterestOrFees) : 0;
    const invalid = validate(centavos, principalCentavos, interestCentavos);
    if (invalid) {
      fields.setFormError(invalid);
      return;
    }

    let installmentInput: CreateCreditCardInstallmentInput | undefined;
    if (!isEdit && card.isCreditCardExpense && card.creditCardPurchaseType === "installment") {
      const built = buildInstallmentInput(card.installment, centavos, fields.description);
      if ("errors" in built) {
        card.setInstallmentErrors(built.errors);
        fields.setFormError("Some installment details are not valid. Check the highlighted fields and try again.");
        return;
      }
      card.setInstallmentErrors({});
      installmentInput = built.input;
    }

    const warning = getBalanceWarning(accounts, fields.txType === "income" ? "" : fields.sourceAccountId, centavos, transaction);
    if (warning && !confirmed) {
      setBalanceWarning(warning);
      return;
    }

    phase.current = "validated";
    setSaving(true);
    try {
      if (fields.txType === "expense" && !savingsWithdrawals) {
        const funding = await getSavingsExpenseFunding(userId, fields.sourceAccountId, centavos, transaction?.id);
        if (funding.requiredWithdrawalCentavos > 0) {
          setSavingsFunding(funding);
          return;
        }
        savingsWithdrawals = [];
      }
      const result = await saveTransaction({
        userId, deviceId, transaction, txType: fields.txType, amountCentavos: centavos, transactionDate: toDateKey(fields.date),
        sourceAccountId: fields.sourceAccountId, destAccountId: fields.destAccountId, subcategoryId: effectiveSubcategoryId,
        description: fields.description, notes: fields.notes,
        creditCardPostingDate: card.isCreditCardExpense ? card.postingDate.trim() || null : null,
        savingsWithdrawals, installment: installmentInput, contributionGoalId: fields.contributionGoalId, savingsActivityContext,
        statementPaymentContext,
        statementPayment: statement.statementPayment, existingStatementPayment: statement.existingStatementPayment,
        debtPaymentContext,
        debtPayment: { active: debt.isDebtPayment, debtAccountId: debt.debtPaymentId, principalCentavos, interestCentavos },
      }, phase);
      if (result.status === "rejected") {
        fields.setFormError(result.message);
        return;
      }

      showToast(statement.isStatementPayment ? "Your credit-card payment was recorded. Review the statement status to confirm the update." : isEdit ? "Transaction updated" : "Transaction saved", "success");
      phase.current = "runSync";
      runSync(userId, deviceId, accessToken).catch((error) => {
        console.error("[ledger] sync after transaction save failed", {
          error_class: error instanceof Error ? error.constructor.name : "UnknownError",
          save_phase: phase.current,
        });
      });

      fields.reset();
      resetCategory();
      card.reset();
      // An edit returns to wherever it was opened from, which refreshes that list.
      if (isEdit) onClose();
      else onCreated?.(result.unusualSpending);
    } catch (error) {
      console.error("[ledger] transaction save failed", {
        error_class: error instanceof Error ? error.constructor.name : "UnknownError",
        save_phase: phase.current,
      });
      fields.setFormError(error instanceof Error ? error.message : "Failed to save transaction");
    } finally {
      setSaving(false);
    }
  }

  return { saving, savingsFunding, setSavingsFunding, balanceWarning, setBalanceWarning, handleSave };
}
