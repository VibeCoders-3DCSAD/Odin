import * as SQLite from "expo-sqlite";
import { validateSavingsGoalContribution, writeSavingsGoalContribution, type SavingsGoalContribution } from "../savings/savingsGoalContributions";
import { readSavingsExpenseFunding, validateSavingsExpenseWithdrawals, replaceExpenseSavingsWithdrawals, type SavingsExpenseWithdrawal } from "../savings/savingsExpenseFunding";
import { enqueueOperation, LocalDbError } from "../../helpers";
import type { SyncOperation } from "../../types";
import { randomUUID } from "../../uuid";
import { updateSavingsGoalActivityForTransactionInTransaction } from "../savings/savingsGoalActivities";
import { getDb, now } from "../helpers/db";
import { applyBalanceEffects, reverseBalanceEffects } from "./transactionBalances";
import { mapTransaction, type TransactionRow } from "./transactionRows";
import type { Transaction, UpdateTransactionInput } from "./transactionTypes";
import { validateUpdatedShape, verifyExpenseAccountCanBeUsed } from "./transactionValidation";

const UPDATE_FIELDS = ["amount_centavos", "subcategory_id", "source_account_id", "destination_account_id", "transaction_date", "credit_card_posting_date", "merchant_name", "counterparty_name", "notes"] as const;

export async function updateTransaction(
  userId: string,
  deviceId: string,
  id: string,
  input: UpdateTransactionInput,
  options?: { allowStatementPayment?: boolean; allowDebtPayment?: boolean; db?: SQLite.SQLiteDatabase },
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = options?.db ?? await getDb();
  const ts = now();

  let result: { transaction: Transaction; operation: SyncOperation };

  const update = async () => {
    const current = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Transaction not found");
    if (!options?.allowStatementPayment && await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM credit_card_payments WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, id,
    )) throw new LocalDbError("VALIDATION_ERROR", "Edit this transaction from its credit-card statement payment.");
    if (!options?.allowDebtPayment && await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM debt_payments WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, id,
    )) throw new LocalDbError("VALIDATION_ERROR", "Edit this transaction from its debt payment.");
    if (await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM scheduled_payment_records WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, id,
    )) throw new LocalDbError("VALIDATION_ERROR", "This transaction pays a biller or remittance. Delete it and record the payment again.");
    const newShape = await validateUpdatedShape(db, userId, current, input);

    const newAmount = input.amount_centavos ?? current.amount_centavos;
    const cardPurchase = await db.getFirstAsync<{
      account_id: string;
      cycle_id: string;
      purchase_type: "regular" | "installment";
      version: number;
    }>(
      `SELECT account_id, cycle_id, purchase_type, version FROM credit_card_transactions
         WHERE transaction_id = ? AND user_id = ? AND deleted = 0`,
      id,
      userId,
    );
    if (cardPurchase?.purchase_type === "installment") {
      throw new LocalDbError("VALIDATION_ERROR", "Installment purchases cannot be edited. Record an issuer-recognized settlement separately when applicable.");
    }
    const cardAmountChanged = Boolean(cardPurchase && input.amount_centavos != null && input.amount_centavos !== current.amount_centavos);
    const newIsCreditCard = newShape.transaction_type === "expense" && newShape.source_account_id
      ? await verifyExpenseAccountCanBeUsed(db, userId, newShape.source_account_id)
      : false;
    if (cardPurchase && input.source_account_id !== undefined && input.source_account_id !== cardPurchase.account_id) {
      throw new LocalDbError(
        "VALIDATION_ERROR",
        "A credit-card purchase cannot be moved to another account after it is recorded.",
      );
    }
    if (!cardPurchase && newIsCreditCard) {
      throw new LocalDbError(
        "VALIDATION_ERROR",
        "Move a transaction to a credit card by recording it as a new credit-card purchase.",
      );
    }
    const effectiveDate = input.credit_card_posting_date === undefined
      ? current.credit_card_posting_date ?? input.transaction_date ?? current.transaction_date
      : input.credit_card_posting_date ?? input.transaction_date ?? current.transaction_date;
    let updatedCycleId: string | null = null;
    if (cardPurchase) {
      const cycle = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM credit_card_cycles
          WHERE user_id = ? AND account_id = ? AND deleted = 0
            AND cycle_start_date <= ? AND cutoff_date >= ?
          ORDER BY cutoff_date ASC LIMIT 1`,
        userId,
        cardPurchase.account_id,
        effectiveDate,
        effectiveDate,
      );
      if (!cycle) {
        throw new LocalDbError(
          "CREDIT_CARD_TRANSACTION_UNAVAILABLE",
          "The edited date is outside an available credit-card billing cycle.",
        );
      }
      updatedCycleId = cycle.id;
    }
    let contribution: SavingsGoalContribution | null = null;
    if (current.destination_savings_goal_id) {
      await validateSavingsGoalContribution(db, userId, current.destination_savings_goal_id, newShape.source_account_id!, newAmount, id, newShape.destination_account_id);
      const activity = await db.getFirstAsync<{ id: string }>("SELECT id FROM savings_goal_activities WHERE user_id = ? AND transaction_id = ? AND savings_goal_id = ? AND activity_kind = 'contribution' AND deleted = 0", userId, id, current.destination_savings_goal_id);
      if (!activity) throw new LocalDbError("VALIDATION_ERROR", "This contribution is unavailable.");
      contribution = { savings_goal_id: current.destination_savings_goal_id, activity_id: activity.id };
    }
    let expenseWithdrawals: SavingsExpenseWithdrawal[] | null = null;
    if (current.transaction_type === "expense") {
      const existing = await db.getAllAsync<{ savings_goal_id: string; amount_centavos: number }>(
        "SELECT savings_goal_id, amount_centavos FROM savings_goal_activities WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, id,
      );
      expenseWithdrawals = (input.savings_goal_withdrawals ?? existing).map((item) => ({ ...item, id: randomUUID() }));
      validateSavingsExpenseWithdrawals(await readSavingsExpenseFunding(db, userId, newShape.source_account_id!, newAmount, id), expenseWithdrawals);
    } else if (input.savings_goal_withdrawals?.length) {
      throw new LocalDbError("VALIDATION_ERROR", "Goal funding is only available for expenses.");
    }
    const balanceChanged =
      input.amount_centavos != null ||
      input.source_account_id != null ||
      input.destination_account_id != null;

    if (balanceChanged) {
      if (!cardPurchase) {
        await reverseBalanceEffects(
          db, userId,
          current.transaction_type,
          current.source_account_id,
          current.destination_account_id,
          current.amount_centavos,
        );
      }

      if (!newIsCreditCard) {
        await applyBalanceEffects(
          db, userId,
          newShape.transaction_type,
          newShape.source_account_id,
          newShape.destination_account_id,
          newAmount,
        );
      }
    }

    if (cardPurchase && cardAmountChanged) {
      await db.runAsync(
        `UPDATE credit_card_details
            SET available_credit_centavos = MIN(credit_limit_centavos,
              COALESCE(available_credit_centavos, credit_limit_centavos) + ? - ?),
                version = version + 1, updated_at = ?
          WHERE account_id = ? AND user_id = ? AND deleted = 0
          `,
        current.amount_centavos,
        newAmount,
        ts,
        cardPurchase.account_id,
        userId,
      );
    }

    const updates: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];
    const changedFields: string[] = [];

    for (const key of UPDATE_FIELDS) {
      const value = (input as Record<string, unknown>)[key];
      if (value === undefined || value === null) continue;
      changedFields.push(key);
      updates.push(`${key} = ?`);
      params.push(value as SQLite.SQLiteBindValue);
    }

    if (!updates.length && expenseWithdrawals) {
      changedFields.push("notes"); updates.push("notes = ?"); params.push(current.notes);
    }
    if (updates.length > 0) {
      updates.push("updated_at = ?");
      params.push(ts);
      updates.push("version = version + 1");

      const sql = `UPDATE transactions SET ${updates.join(", ")} WHERE user_id = ? AND id = ?`;
      params.push(userId);
      params.push(id);
      await db.runAsync(sql, ...params);
    }

    if (contribution) {
      await writeSavingsGoalContribution(db, userId, id, contribution, newAmount, input.transaction_date ?? current.transaction_date, input.notes ?? current.notes);
    } else if (expenseWithdrawals) {
      expenseWithdrawals = await replaceExpenseSavingsWithdrawals(db, userId, id, expenseWithdrawals, input.transaction_date ?? current.transaction_date, input.notes ?? current.notes);
    } else {
      await updateSavingsGoalActivityForTransactionInTransaction(db, userId, deviceId, id, {
        amountCentavos: newAmount, activityDate: input.transaction_date ?? current.transaction_date, notes: input.notes ?? current.notes,
      });
    }

    if (cardPurchase && updatedCycleId !== cardPurchase.cycle_id) {
      await db.runAsync(
        `UPDATE credit_card_transactions SET cycle_id = ?, version = version + 1, updated_at = ?
          WHERE transaction_id = ? AND user_id = ? AND deleted = 0`,
        updatedCycleId,
        ts,
        id,
        userId,
      );
      await enqueueOperation(db, {
        userId,
        deviceId,
        entity: "credit_card_transactions",
        recordId: id,
        operationType: "update",
        baseVersion: cardPurchase.version,
        changedFields: ["cycle_id"],
        payload: { cycle_id: updatedCycleId },
        failureMessage: "This credit-card transaction could not be moved to its billing cycle.",
      });
    }

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "transactions",
      recordId: id,
      operationType: "update",
      baseVersion: current.version,
      changedFields,
      payload: { ...input, ...(contribution ? { savings_goal_contribution: contribution } : {}), ...(expenseWithdrawals ? { savings_goal_withdrawals: expenseWithdrawals } : {}),
        ...(input.notes === undefined && changedFields.includes("notes") ? { notes: current.notes } : {}),
      },
      failureMessage: `This transaction could not be updated.`,
    });

    const row = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ?",
      userId,
      id,
    );
    result = { transaction: mapTransaction(row!), operation };
  };

  if (options?.db) await update();
  else await db.withTransactionAsync(update);

  return result!;
}
