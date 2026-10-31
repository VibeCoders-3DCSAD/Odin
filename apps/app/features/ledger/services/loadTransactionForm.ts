import { getCreditCardPaymentByStatement, type StatementPaymentContext } from "../../../local-db/repositories/credit-cards/creditCardPayments";
import { getDebtAccount } from "../../../local-db/repositories/debts/debtAccounts";
import { listDebtPayments, type DebtPaymentContext } from "../../../local-db/repositories/debts/debtPayments";
import { getTransaction, type Transaction } from "../../../local-db/repositories/ledger/ledger";
import { getSavingsGoal } from "../../../local-db/repositories/savings/savingsGoals";
import type { SavingsActivityKind, TransactionFormTarget } from "../transactionFormRoute";

export type TransactionFormProps = {
  transaction?: Transaction;
  statementPaymentContext?: StatementPaymentContext;
  debtPaymentDebtId?: string;
  debtPaymentContext?: DebtPaymentContext;
  savingsActivityContext?: { savingsGoalId: string; kind: SavingsActivityKind; amountCentavos?: number };
};

// Turns a parsed /activity/new target into NewTransactionScreen props, checking that every referenced
// record belongs to this user and that the records belong together. Null means it cannot be opened.
export async function loadTransactionForm(userId: string, target: TransactionFormTarget): Promise<TransactionFormProps | null> {
  switch (target.kind) {
    case "new":
      return {};
    case "edit": {
      const transaction = await ownTransaction(userId, target.transactionId);
      return transaction ? { transaction } : null;
    }
    case "pay-statement":
      // The form itself rejects a statement that is not this user's current authoritative one.
      return { statementPaymentContext: { statementId: target.statementId, cycleId: target.cycleId } };
    case "edit-statement-payment": {
      const transaction = await ownTransaction(userId, target.transactionId);
      const payment = await getCreditCardPaymentByStatement(userId, target.statementId);
      if (!transaction || payment?.transaction_id !== transaction.id || payment.cycle_id !== target.cycleId) return null;
      return { transaction, statementPaymentContext: { statementId: target.statementId, cycleId: target.cycleId } };
    }
    case "record-debt-payment": {
      const debt = await getDebtAccount(userId, target.debtAccountId);
      return debt ? { debtPaymentDebtId: debt.id } : null;
    }
    case "edit-debt-payment": {
      const transaction = await ownTransaction(userId, target.transactionId);
      const payments = transaction ? await listDebtPayments(userId, target.debtAccountId) : [];
      const payment = payments.find((item) => item.id === target.debtPaymentId);
      if (!transaction || payment?.transaction_id !== transaction.id) return null;
      return { transaction, debtPaymentContext: { paymentId: payment.id, debtAccountId: payment.debt_account_id } };
    }
    case "savings-activity": {
      const goal = await getSavingsGoal(userId, target.savingsGoalId);
      if (!goal) return null;
      return { savingsActivityContext: { savingsGoalId: goal.id, kind: target.activity, amountCentavos: target.amountCentavos } };
    }
  }
}

// getTransaction matches on user_id, so another user's id reads as missing.
function ownTransaction(userId: string, transactionId: string) {
  return getTransaction(userId, transactionId);
}
