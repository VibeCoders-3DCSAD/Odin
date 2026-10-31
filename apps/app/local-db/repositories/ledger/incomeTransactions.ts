import * as SQLite from "expo-sqlite";
import { enqueueOperation } from "../../helpers";
import type { SyncOperation } from "../../types";
import { randomUUID } from "../../uuid";
import { getDb, now } from "../helpers/db";
import { applyBalanceEffects } from "./transactionBalances";
import { buildTransactionInsert, mapTransaction, type TransactionRow } from "./transactionRows";
import type { CreateIncomeInput, Transaction } from "./transactionTypes";
import { validateIncomeShape } from "./transactionValidation";

export async function createIncomeInTransaction(
  db: SQLite.SQLiteDatabase,
  userId: string,
  deviceId: string,
  input: CreateIncomeInput,
  options?: { id?: string },
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const ts = now();
  const id = options?.id ?? randomUUID();
  await validateIncomeShape(db, userId, input);

  await applyBalanceEffects(
    db, userId, "income", null, input.destination_account_id, input.amount_centavos,
  );

  const { sql, params } = buildTransactionInsert(id, userId, "income", input, ts);
  await db.runAsync(sql, ...params);

  const operation = await enqueueOperation(db, {
    userId,
    deviceId,
    entity: "transactions",
    recordId: id,
    operationType: "create",
    baseVersion: null,
    changedFields: [],
    payload: {
      ...input,
      transaction_type: "income",
      subcategory_id: input.subcategory_id,
      source_account_id: null,
      destination_account_id: input.destination_account_id,
    },
    failureMessage: `This income transaction could not be created.`,
  });

  const row = await db.getFirstAsync<TransactionRow>(
    "SELECT * FROM transactions WHERE user_id = ? AND id = ?",
    userId,
    id,
  );
  return { transaction: mapTransaction(row!), operation };
}

export async function createIncome(
  userId: string,
  deviceId: string,
  input: CreateIncomeInput,
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = await getDb();

  let result: { transaction: Transaction; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    result = await createIncomeInTransaction(db, userId, deviceId, input);
  });

  return result!;
}
