import * as SQLite from "expo-sqlite";
import { replaceExpenseSavingsWithdrawals } from "../savings/savingsExpenseFunding";
import { enqueueOperation, LocalDbError } from "../../helpers";
import type { SyncOperation } from "../../types";
import { deleteSavingsGoalActivityForTransactionInTransaction } from "../savings/savingsGoalActivities";
import { deleteScheduledPaymentRecordForTransactionInTransaction } from "../scheduled-payments/scheduledPaymentRecords";
import { getDb, now } from "../helpers/db";
import { reverseBalanceEffects } from "./transactionBalances";
import { mapTransaction, type TransactionRow } from "./transactionRows";
import type { Transaction } from "./transactionTypes";

export async function deleteTransaction(
  userId: string,
  deviceId: string,
  id: string,
  options?: { allowStatementPayment?: boolean; allowDebtPayment?: boolean; db?: SQLite.SQLiteDatabase },
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = options?.db ?? await getDb();
  const ts = now();

  let result: { transaction: Transaction; operation: SyncOperation };

  const remove = async () => {
    const current = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Transaction not found");
    if (!options?.allowStatementPayment && await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM credit_card_payments WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, id,
    )) throw new LocalDbError("VALIDATION_ERROR", "Delete this transaction from its credit-card statement payment.");
    if (!options?.allowDebtPayment && await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM debt_payments WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, id,
    )) throw new LocalDbError("VALIDATION_ERROR", "Delete this transaction from its debt payment.");
    const cardPurchase = await db.getFirstAsync<{
      account_id: string;
      amount_centavos: number;
      version: number;
    }>(
      `SELECT cct.account_id, cct.version, t.amount_centavos
         FROM credit_card_transactions cct
         JOIN transactions t ON t.id = cct.transaction_id AND t.user_id = cct.user_id
        WHERE cct.transaction_id = ? AND cct.user_id = ? AND cct.deleted = 0`,
      id,
      userId,
    );
    if (!cardPurchase) {
      await reverseBalanceEffects(
        db, userId,
        current.transaction_type,
        current.source_account_id,
        current.destination_account_id,
        current.amount_centavos,
      );
    }
    if (cardPurchase) {
      await db.runAsync(
        `UPDATE credit_card_details
            SET available_credit_centavos = MIN(credit_limit_centavos, COALESCE(available_credit_centavos, credit_limit_centavos) + ?),
                version = version + 1, updated_at = ?
          WHERE account_id = ? AND user_id = ? AND deleted = 0`,
        cardPurchase.amount_centavos,
        ts,
        cardPurchase.account_id,
        userId,
      );
      await db.runAsync(
        "UPDATE credit_card_transactions SET deleted = 1, version = version + 1, updated_at = ? WHERE transaction_id = ? AND user_id = ? AND deleted = 0",
        ts,
        id,
        userId,
      );
      await enqueueOperation(db, {
        userId,
        deviceId,
        entity: "credit_card_transactions",
        recordId: id,
        operationType: "delete",
        baseVersion: cardPurchase.version,
        changedFields: [],
        payload: { transaction_id: id },
        failureMessage: "This credit-card transaction could not be deleted.",
      });
    }

    await db.runAsync(
      "UPDATE transactions SET status = 'deleted', deleted = 1, version = version + 1, updated_at = ? WHERE user_id = ? AND id = ?",
      ts,
      userId,
      id,
    );

    if (current.transaction_type === "expense" || current.destination_savings_goal_id) {
      await replaceExpenseSavingsWithdrawals(db, userId, id, [], current.transaction_date, current.notes);
    } else {
      await deleteSavingsGoalActivityForTransactionInTransaction(db, userId, deviceId, id);
    }
    await deleteScheduledPaymentRecordForTransactionInTransaction(db, userId, deviceId, id);

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "transactions",
      recordId: id,
      operationType: "delete",
      baseVersion: current.version,
      changedFields: [],
      payload: { id },
      failureMessage: `This transaction could not be deleted.`,
    });

    const row = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ?",
      userId,
      id,
    );
    result = { transaction: mapTransaction(row!), operation };
  };

  if (options?.db) await remove();
  else await db.withTransactionAsync(remove);

  return result!;
}
