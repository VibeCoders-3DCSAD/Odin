import { useState } from "react";
import type { Transaction } from "../../../local-db/repositories/ledger";
import type { StatementPaymentContext } from "../../../local-db/repositories/creditCardPayments";
import type { TransactionType } from "../components/TransactionTypeSelector";
import type { TransactionFormProps } from "../services/loadTransactionForm";
import { fromDateKey } from "../helpers/transactionFormat";

type Options = {
  transaction?: Transaction;
  statementPaymentContext?: StatementPaymentContext;
  savingsActivityContext?: TransactionFormProps["savingsActivityContext"];
};

// The fields every transaction type shares, seeded from the record being edited or the flow that opened the form.
export function useTransactionFormFields({ transaction, statementPaymentContext, savingsActivityContext }: Options) {
  const [isSavingsContribution, setIsSavingsContribution] = useState(false);
  const [selectedSavingsGoalId, setSelectedSavingsGoalId] = useState<string | null>(null);
  const [txType, setTxType] = useState<TransactionType>(savingsActivityContext ? "transfer" : statementPaymentContext ? "expense" : (transaction?.transaction_type as TransactionType) ?? "expense");
  const contributionGoalId = savingsActivityContext?.kind === "contribution" ? savingsActivityContext.savingsGoalId : transaction?.destination_savings_goal_id ?? (isSavingsContribution && txType === "transfer" ? selectedSavingsGoalId : null);
  const [amount, setAmount] = useState(transaction ? String(transaction.amount_centavos / 100) : savingsActivityContext?.amountCentavos ? String(savingsActivityContext.amountCentavos / 100) : "");
  const [date, setDate] = useState(transaction ? fromDateKey(transaction.transaction_date) : new Date());
  const [sourceAccountId, setSourceAccountId] = useState(transaction?.source_account_id ?? "");
  const [destAccountId, setDestAccountId] = useState(transaction?.destination_account_id ?? "");
  const [description, setDescription] = useState(transaction?.merchant_name ?? transaction?.counterparty_name ?? "");
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  function changeType(type: TransactionType) {
    setTxType(type);
    setIsSavingsContribution(false);
    setSelectedSavingsGoalId(null);
    setSourceAccountId("");
    setDestAccountId("");
    setFormError(null);
  }

  function toggleSavingsContribution() {
    setIsSavingsContribution((current) => !current);
    setTxType("transfer");
    setSelectedSavingsGoalId(null);
    setSourceAccountId("");
    setDestAccountId("");
    setFormError(null);
  }

  function selectSavingsGoal(id: string) {
    setSelectedSavingsGoalId(id);
    setSourceAccountId("");
    setFormError(null);
  }

  function reset() {
    setAmount("");
    setDescription("");
    setNotes("");
    setSourceAccountId("");
    setDestAccountId("");
    setFormError(null);
  }

  return {
    txType, isSavingsContribution, selectedSavingsGoalId, contributionGoalId,
    amount, setAmount, date, setDate, sourceAccountId, setSourceAccountId, destAccountId, setDestAccountId,
    description, setDescription, notes, setNotes, formError, setFormError,
    changeType, toggleSavingsContribution, selectSavingsGoal, reset,
  };
}

export type TransactionFormFields = ReturnType<typeof useTransactionFormFields>;
