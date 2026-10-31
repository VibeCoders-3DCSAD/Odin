import { createExpense, createIncome, createSavingsGoalTransfer, createTransfer, updateTransaction, type Transaction, type UpdateTransactionInput } from "../../../local-db/repositories/ledger";
import { createStatementPayment, updateStatementPayment, type CreditCardPayment, type StatementPaymentContext } from "../../../local-db/repositories/creditCardPayments";
import type { CreditCardStatement } from "../../../local-db/repositories/creditCardStatements";
import { createTransactionDebtPayment, updateTransactionDebtPayment, type DebtPaymentContext } from "../../../local-db/repositories/debtPayments";
import type { CreateCreditCardInstallmentInput } from "../../../local-db/repositories/creditCardInstallments";
import type { SavingsExpenseWithdrawal } from "../../../local-db/repositories/savingsExpenseFunding";
import { getUnusualSpending, saveUnusualSpending, type UnusualSpendingInsight } from "../../../local-db/repositories/unusualSpending";
import type { TransactionType } from "../components/TransactionTypeSelector";
import type { TransactionFormProps } from "./loadTransactionForm";

export type SaveTransactionRequest = {
  userId: string;
  deviceId: string;
  transaction?: Transaction;
  txType: TransactionType;
  amountCentavos: number;
  transactionDate: string;
  sourceAccountId: string;
  destAccountId: string;
  subcategoryId: string;
  description: string;
  notes: string;
  // Already null unless the source is a credit card.
  creditCardPostingDate: string | null;
  savingsWithdrawals?: SavingsExpenseWithdrawal[];
  installment?: CreateCreditCardInstallmentInput;
  contributionGoalId: string | null;
  savingsActivityContext?: TransactionFormProps["savingsActivityContext"];
  statementPaymentContext?: StatementPaymentContext;
  statementPayment: CreditCardStatement | null;
  existingStatementPayment: CreditCardPayment | null;
  debtPaymentContext?: DebtPaymentContext;
  debtPayment: { active: boolean; debtAccountId: string; principalCentavos: number; interestCentavos: number };
};

export type SaveTransactionResult =
  | { status: "saved"; unusualSpending: UnusualSpendingInsight | null }
  | { status: "rejected"; message: string };

// Writes the form through the repository that owns its flow. `phase.current` tracks the step reached so
// a failure can be logged without its payload.
export async function saveTransaction(request: SaveTransactionRequest, phase: { current: string }): Promise<SaveTransactionResult> {
  const { userId, deviceId, transaction, txType, amountCentavos: centavos, transactionDate: dateStr, sourceAccountId, destAccountId, subcategoryId: effectiveSubcategoryId, description, notes, savingsWithdrawals, contributionGoalId, savingsActivityContext, statementPaymentContext, debtPaymentContext, debtPayment } = request;
  const isEdit = !!transaction;
  const isStatementPayment = Boolean(statementPaymentContext);
  let createdExpense: Transaction | null = null;
  if (isStatementPayment && (!request.statementPayment || (isEdit && !request.existingStatementPayment))) {
    return { status: "rejected", message: "The selected credit-card statement is no longer available." };
  }
  if (isEdit && isStatementPayment && request.existingStatementPayment) {
    await updateStatementPayment(userId, deviceId, request.existingStatementPayment.id, {
      savings_goal_withdrawals: savingsWithdrawals, amount_centavos: centavos, source_account_id: sourceAccountId, subcategory_id: effectiveSubcategoryId,
      transaction_date: dateStr, merchant_name: description.trim() || undefined, notes: notes.trim() || undefined,
    });
  } else if (isEdit && debtPaymentContext) {
    await updateTransactionDebtPayment(userId, deviceId, debtPaymentContext.paymentId, { savings_goal_withdrawals: savingsWithdrawals, amount_centavos: centavos, principal_centavos: debtPayment.principalCentavos, interest_centavos: debtPayment.interestCentavos, source_account_id: sourceAccountId, subcategory_id: effectiveSubcategoryId, transaction_date: dateStr, merchant_name: description.trim() || undefined, notes: notes.trim() || undefined });
  } else if (isEdit) {
    phase.current = "updateTransaction";
    const updateInput: Record<string, unknown> = {
      amount_centavos: centavos,
      transaction_date: dateStr,
      notes: notes.trim() || "",
    };

    if (txType === "expense") {
      updateInput.savings_goal_withdrawals = savingsWithdrawals;
      updateInput.source_account_id = sourceAccountId;
      updateInput.subcategory_id = effectiveSubcategoryId;
      updateInput.merchant_name = description.trim() || "";
      updateInput.credit_card_posting_date = request.creditCardPostingDate;
    } else if (txType === "income") {
      updateInput.destination_account_id = destAccountId;
      updateInput.subcategory_id = effectiveSubcategoryId;
      updateInput.counterparty_name = description.trim() || "";
    } else {
      updateInput.source_account_id = sourceAccountId;
      if (!contributionGoalId) updateInput.destination_account_id = destAccountId;
      const desc = description.trim();
      const note = notes.trim();
      updateInput.notes = desc && note ? `${desc} — ${note}` : (desc || note || "");
    }

    await updateTransaction(userId, deviceId, transaction.id, updateInput as UpdateTransactionInput);
  } else if (isStatementPayment && statementPaymentContext) {
    await createStatementPayment(userId, deviceId, {
      savings_goal_withdrawals: savingsWithdrawals,
      statementId: statementPaymentContext.statementId,
      cycleId: statementPaymentContext.cycleId,
      amount_centavos: centavos,
      source_account_id: sourceAccountId,
      subcategory_id: effectiveSubcategoryId,
      transaction_date: dateStr,
      merchant_name: description.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  } else if (debtPayment.active && txType === "expense") {
    await createTransactionDebtPayment(userId, deviceId, { savings_goal_withdrawals: savingsWithdrawals, debt_account_id: debtPayment.debtAccountId, amount_centavos: centavos, principal_centavos: debtPayment.principalCentavos, interest_centavos: debtPayment.interestCentavos, source_account_id: sourceAccountId, subcategory_id: effectiveSubcategoryId, transaction_date: dateStr, merchant_name: description.trim() || undefined, notes: notes.trim() || undefined });
  } else if (txType === "expense") {
    phase.current = "createExpense";
    const result = await createExpense(userId, deviceId, {
      savings_goal_withdrawals: savingsWithdrawals,
      amount_centavos: centavos,
      source_account_id: sourceAccountId,
      subcategory_id: effectiveSubcategoryId,
      transaction_date: dateStr,
      credit_card_posting_date: request.creditCardPostingDate,
      merchant_name: description.trim() || undefined,
      notes: notes.trim() || undefined,
      installment: request.installment,
    });
    createdExpense = result.transaction;
  } else if (txType === "income") {
    phase.current = "createIncome";
    await createIncome(userId, deviceId, {
      amount_centavos: centavos,
      destination_account_id: destAccountId,
      subcategory_id: effectiveSubcategoryId,
      transaction_date: dateStr,
      counterparty_name: description.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  } else if (contributionGoalId && !savingsActivityContext) {
    await createSavingsGoalTransfer(userId, deviceId, { savings_goal_id: contributionGoalId, kind: "contribution", account_id: sourceAccountId, amount_centavos: centavos, transaction_date: dateStr, notes: [description.trim(), notes.trim()].filter(Boolean).join(" — ") || undefined });
  } else if (savingsActivityContext) {
    const accountId = savingsActivityContext.kind === "contribution" ? sourceAccountId : destAccountId;
    if (!accountId) {
      return { status: "rejected", message: `Select the ${savingsActivityContext.kind === "contribution" ? "source" : "destination"} account` };
    }
    await createSavingsGoalTransfer(userId, deviceId, { savings_goal_id: savingsActivityContext.savingsGoalId, kind: savingsActivityContext.kind, account_id: accountId, amount_centavos: centavos, transaction_date: dateStr, notes: notes.trim() || undefined });
  } else {
    const desc = description.trim();
    const note = notes.trim();
    const mergedNotes = desc && note ? `${desc} — ${note}` : (desc || note || undefined);
    phase.current = "createTransfer";
    await createTransfer(userId, deviceId, {
      amount_centavos: centavos,
      source_account_id: sourceAccountId,
      destination_account_id: destAccountId,
      transaction_date: dateStr,
      notes: mergedNotes,
    });
  }

  return { status: "saved", unusualSpending: createdExpense ? await evaluateUnusualSpending(userId, deviceId, createdExpense) : null };
}

// Best effort: a failed evaluation never fails the save.
async function evaluateUnusualSpending(userId: string, deviceId: string, expense: Transaction): Promise<UnusualSpendingInsight | null> {
  try {
    const insight = await getUnusualSpending(userId, expense.id);
    if (insight) await saveUnusualSpending(userId, deviceId, insight);
    return insight;
  } catch (error) {
    console.error("[UNUSUAL-SPENDING] evaluation failed", error);
    return null;
  }
}
