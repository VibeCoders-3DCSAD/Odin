import { validateSavingsGoalContribution, writeSavingsGoalContribution, type SavingsGoalContribution } from "../savings/savingsGoalContributions";
import { enqueueOperation, LocalDbError } from "../../helpers";
import type { SyncOperation } from "../../types";
import { randomUUID } from "../../uuid";
import { validateIsoDate } from "../credit-cards/creditCardCycleDates";
import { createSavingsGoalActivityInTransaction } from "../savings/savingsGoalActivities";
import { getDb, now } from "../helpers/db";
import { applyBalanceEffects } from "./transactionBalances";
import { buildTransactionInsert, mapTransaction, type TransactionRow } from "./transactionRows";
import type { CreateTransferInput, Transaction } from "./transactionTypes";
import { validateAmount, verifyAccountOwnership } from "./transactionValidation";

export async function createSavingsGoalTransfer(
  userId: string,
  deviceId: string,
  input: { savings_goal_id: string; kind: "contribution" | "withdrawal"; account_id: string; amount_centavos: number; transaction_date: string; notes?: string },
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  validateAmount(input.amount_centavos);
  validateIsoDate(input.transaction_date, "transaction_date");
  const db = await getDb(); const id = randomUUID(); const ts = now();
  let result!: { transaction: Transaction; operation: SyncOperation };
  await db.withTransactionAsync(async () => {
    if (input.kind !== "contribution" && input.kind !== "withdrawal") throw new LocalDbError("VALIDATION_ERROR", "Savings activity kind is invalid.");
    if (input.kind === "withdrawal") {
      const goal = await db.getFirstAsync<{ status: string }>("SELECT status FROM savings_goals WHERE id = ? AND user_id = ? AND deleted = 0", input.savings_goal_id, userId);
      if (!goal || goal.status !== "active") throw new LocalDbError("VALIDATION_ERROR", "Savings activities require an active savings goal.");
      await verifyAccountOwnership(db, userId, input.account_id, "financial account");
    }
    const sourceAccountId = input.kind === "contribution" ? input.account_id : null;
    const destinationAccountId = input.kind === "contribution"
      ? await validateSavingsGoalContribution(db, userId, input.savings_goal_id, input.account_id, input.amount_centavos)
      : input.account_id;
    const contribution: SavingsGoalContribution | null = input.kind === "contribution" ? { savings_goal_id: input.savings_goal_id, activity_id: randomUUID() } : null;
    const transactionInput: CreateTransferInput = { amount_centavos: input.amount_centavos, source_account_id: sourceAccountId ?? "", destination_account_id: destinationAccountId ?? "", transaction_date: input.transaction_date, notes: input.notes, source_savings_goal_id: input.kind === "withdrawal" ? input.savings_goal_id : null, destination_savings_goal_id: input.kind === "contribution" ? input.savings_goal_id : null };
    if (sourceAccountId) await applyBalanceEffects(db, userId, "expense", sourceAccountId, null, input.amount_centavos);
    if (destinationAccountId) await applyBalanceEffects(db, userId, "income", null, destinationAccountId, input.amount_centavos);
    const { sql, params } = buildTransactionInsert(id, userId, "transfer", transactionInput, ts);
    await db.runAsync(sql, ...params);
    const payload = {
      transaction_type: "transfer", transaction_date: input.transaction_date, amount_centavos: input.amount_centavos,
      source_account_id: sourceAccountId, destination_account_id: destinationAccountId, subcategory_id: null, notes: input.notes ?? null,
      ...(contribution ? { savings_goal_contribution: contribution } : {
        source_savings_goal_id: transactionInput.source_savings_goal_id, destination_savings_goal_id: transactionInput.destination_savings_goal_id,
      }),
    };
    const operation = await enqueueOperation(db, { userId, deviceId, entity: "transactions", recordId: id, operationType: "create", baseVersion: null, changedFields: [], payload, failureMessage: "This savings transfer could not be created." });
    if (contribution) await writeSavingsGoalContribution(db, userId, id, contribution, input.amount_centavos, input.transaction_date, input.notes ?? null);
    else await createSavingsGoalActivityInTransaction(db, userId, deviceId, { savingsGoalId: input.savings_goal_id, transactionId: id, kind: input.kind, amountCentavos: input.amount_centavos, activityDate: input.transaction_date, notes: input.notes });
    const row = await db.getFirstAsync<TransactionRow>("SELECT * FROM transactions WHERE user_id = ? AND id = ?", userId, id);
    result = { transaction: mapTransaction(row!), operation };
  });
  return result;
}
