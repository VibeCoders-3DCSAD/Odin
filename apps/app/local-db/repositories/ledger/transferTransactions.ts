import { enqueueOperation } from "../../helpers";
import type { SyncOperation } from "../../types";
import { randomUUID } from "../../uuid";
import { getDb, now } from "../helpers/db";
import { applyBalanceEffects } from "./transactionBalances";
import { buildTransactionInsert, mapTransaction, type TransactionRow } from "./transactionRows";
import type { CreateTransferInput, Transaction } from "./transactionTypes";
import { validateTransferShape } from "./transactionValidation";

export async function createTransfer(
  userId: string,
  deviceId: string,
  input: CreateTransferInput,
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();
  const id = randomUUID();

  let result: { transaction: Transaction; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    await validateTransferShape(db, userId, input);

    await applyBalanceEffects(
      db, userId, "transfer", input.source_account_id, input.destination_account_id, input.amount_centavos,
    );

    const { sql, params } = buildTransactionInsert(id, userId, "transfer", input, ts);
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
        transaction_type: "transfer",
        subcategory_id: null,
        source_account_id: input.source_account_id,
        destination_account_id: input.destination_account_id,
      },
      failureMessage: `This transfer transaction could not be created.`,
    });

    const row = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ?",
      userId,
      id,
    );
    result = { transaction: mapTransaction(row!), operation };
  });

  return result!;
}
