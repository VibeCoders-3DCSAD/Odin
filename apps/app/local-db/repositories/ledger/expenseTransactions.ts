import * as SQLite from "expo-sqlite";
import { readSavingsExpenseFunding, validateSavingsExpenseWithdrawals, replaceExpenseSavingsWithdrawals } from "../savings/savingsExpenseFunding";
import { enqueueOperation, LocalDbError } from "../../helpers";
import type { SyncOperation } from "../../types";
import { randomUUID } from "../../uuid";
import { ensureCurrentCreditCardCycles } from "../credit-cards/creditCardCycles";
import { createCreditCardInstallmentInTransaction } from "../credit-cards/creditCardInstallments";
import { getDb, now } from "../helpers/db";
import { applyBalanceEffects } from "./transactionBalances";
import { buildTransactionInsert, mapTransaction, type TransactionRow } from "./transactionRows";
import type { CreateExpenseInput, ExpenseInsertInput, Transaction } from "./transactionTypes";
import { validateExpenseShape, verifyExpenseAccountCanBeUsed } from "./transactionValidation";

export async function createExpenseInTransaction(
  db: SQLite.SQLiteDatabase,
  userId: string,
  deviceId: string,
  input: ExpenseInsertInput,
  options?: { id?: string },
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const ts = now();
  const id = options?.id ?? randomUUID();
  const isCreditCard = await verifyExpenseAccountCanBeUsed(db, userId, input.source_account_id);
  await validateExpenseShape(db, userId, input);
  const withdrawals = input.savings_goal_withdrawals ?? [];
  validateSavingsExpenseWithdrawals(await readSavingsExpenseFunding(db, userId, input.source_account_id, input.amount_centavos), withdrawals);
  if (!isCreditCard) {
    await applyBalanceEffects(db, userId, "expense", input.source_account_id, null, input.amount_centavos);
  }
  const { sql, params } = buildTransactionInsert(id, userId, "expense", input, ts);
  await db.runAsync(sql, ...params);
  await replaceExpenseSavingsWithdrawals(db, userId, id, withdrawals, input.transaction_date, input.notes ?? null);
  const { installment: _installment, ...transactionInput } = input;
  const operation = await enqueueOperation(db, {
    userId, deviceId, entity: "transactions", recordId: id, operationType: "create",
    baseVersion: null, changedFields: [],
     payload: { ...transactionInput, transaction_type: "expense", destination_account_id: null },
    failureMessage: "This expense transaction could not be created.",
  });
  if (isCreditCard) {
    const cycle = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM credit_card_cycles
        WHERE user_id = ? AND account_id = ? AND deleted = 0
          AND cycle_start_date <= ? AND cutoff_date >= ?
        ORDER BY cutoff_date ASC LIMIT 1`,
      userId,
      input.source_account_id,
      input.credit_card_posting_date ?? input.transaction_date,
      input.credit_card_posting_date ?? input.transaction_date,
    );
    if (!cycle) {
      throw new LocalDbError(
        "CREDIT_CARD_TRANSACTION_UNAVAILABLE",
        "Credit-card transactions cannot be recorded until billing-cycle routing is available.",
      );
    }
    const installment = input.installment
      ? await createCreditCardInstallmentInTransaction(
          db,
          userId,
          deviceId,
          input.source_account_id,
          id,
          input.installment,
          ts,
        )
      : null;
    const purchaseType = installment ? "installment" : "regular";
    await db.runAsync(
      `INSERT INTO credit_card_transactions
         (transaction_id, user_id, account_id, cycle_id, purchase_type, installment_id, forecast_recorded_at,
         client_mutation_id, applied_credit_centavos, version, deleted, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, ?, ?)`,
      id,
      userId,
      input.source_account_id,
      cycle.id,
      purchaseType,
       installment?.installment.id ?? null,
       ts,
      input.client_mutation_id ?? id,
      ts,
      ts,
    );
    await db.runAsync(
      `UPDATE credit_card_details
          SET available_credit_centavos = COALESCE(available_credit_centavos, credit_limit_centavos) - ?,
              version = version + 1,
              updated_at = ?
         WHERE account_id = ? AND user_id = ? AND deleted = 0
          `,
      input.amount_centavos,
      ts,
      input.source_account_id,
      userId,
    );
    await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "credit_card_transactions",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: ["transaction_id", "account_id", "cycle_id", "purchase_type", "installment_id", "forecast_recorded_at", "client_mutation_id"],
      payload: {
        transaction_id: id,
        account_id: input.source_account_id,
        cycle_id: cycle.id,
        purchase_type: purchaseType,
        installment_id: installment?.installment.id ?? null,
        forecast_recorded_at: ts,
        client_mutation_id: input.client_mutation_id ?? id,
      },
      failureMessage: "This credit-card transaction could not be recorded.",
    });
  }
  const row = await db.getFirstAsync<TransactionRow>("SELECT * FROM transactions WHERE user_id = ? AND id = ?", userId, id);
  return { transaction: mapTransaction(row!), operation };
}

export async function createExpense(
  userId: string,
  deviceId: string,
  input: CreateExpenseInput,
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = await getDb();

  const creditCard = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM financial_accounts WHERE user_id = ? AND id = ? AND kind = 'credit_card' AND status = 'active' AND deleted = 0",
    userId,
    input.source_account_id,
  );
  if (creditCard) {
    await ensureCurrentCreditCardCycles(userId, deviceId, input.credit_card_posting_date ?? input.transaction_date);
  }

  let result!: { transaction: Transaction; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    result = await createExpenseInTransaction(db, userId, deviceId, input);
  });

  return result!;
}
