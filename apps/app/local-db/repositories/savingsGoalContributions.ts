import type { SQLiteDatabase } from "expo-sqlite";
import { initDatabase } from "../client";
import { LocalDbError } from "../helpers";
import { assertActiveSavingsGoalAccount } from "./savingsGoalAccounts";
import { readSavingsExpenseFunding } from "./savingsExpenseFunding";

export type SavingsContributionGoalOption = { id: string; name: string; linkedAccountName: string };

export async function listSavingsContributionGoals(userId: string): Promise<SavingsContributionGoalOption[]> {
  const db = await initDatabase();
  return db.getAllAsync<SavingsContributionGoalOption>(
    `SELECT g.id, g.name, a.name AS linkedAccountName FROM savings_goals g
     JOIN financial_accounts a ON a.id = g.linked_account_id AND a.user_id = g.user_id
     WHERE g.user_id = ? AND g.deleted = 0 AND g.status = 'active'
       AND a.deleted = 0 AND a.status = 'active' AND a.kind <> 'credit_card'
     ORDER BY g.name COLLATE NOCASE, g.id LIMIT 100`,
    userId,
  );
}

export type SavingsGoalContribution = { savings_goal_id: string; activity_id: string };

export async function validateSavingsGoalContribution(
  db: SQLiteDatabase, userId: string, goalId: string, sourceAccountId: string, amountCentavos: number,
  transactionId?: string, destinationAccountId?: string | null,
): Promise<string> {
  const goal = await db.getFirstAsync<{ linked_account_id: string | null; status: string }>(
    "SELECT linked_account_id, status FROM savings_goals WHERE id = ? AND user_id = ? AND deleted = 0", goalId, userId,
  );
  if (!goal || goal.status !== "active") throw new LocalDbError("VALIDATION_ERROR", "Contributions require an active savings goal.");
  await assertActiveSavingsGoalAccount(db, userId, goal.linked_account_id);
  if (sourceAccountId !== goal.linked_account_id) await assertActiveSavingsGoalAccount(db, userId, sourceAccountId);
  if (destinationAccountId !== undefined && destinationAccountId !== goal.linked_account_id) throw new LocalDbError("VALIDATION_ERROR", "The destination must be the goal's linked account.");
  const funding = await readSavingsExpenseFunding(db, userId, sourceAccountId, 0, transactionId);
  if (amountCentavos > funding.unallocatedCentavos) throw new LocalDbError("VALIDATION_ERROR", "The contribution exceeds the available money in this account. Money set aside for other goals cannot be used.");
  return goal.linked_account_id!;
}

export async function writeSavingsGoalContribution(
  db: SQLiteDatabase, userId: string, transactionId: string, contribution: SavingsGoalContribution,
  amountCentavos: number, activityDate: string, notes: string | null,
): Promise<void> {
  if (notes !== null && (typeof notes !== "string" || notes.length > 1_000)) throw new LocalDbError("VALIDATION_ERROR", "Contribution notes must be 1000 characters or fewer.");
  const ts = new Date().toISOString();
  const result = await db.runAsync(`INSERT INTO savings_goal_activities
    (id, user_id, savings_goal_id, transaction_id, activity_kind, amount_centavos, activity_date, notes, version, deleted, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'contribution', ?, ?, ?, 1, 0, ?, ?)
    ON CONFLICT(id) DO UPDATE SET amount_centavos = excluded.amount_centavos, activity_date = excluded.activity_date,
      notes = excluded.notes, version = savings_goal_activities.version + 1, updated_at = excluded.updated_at
    WHERE savings_goal_activities.user_id = excluded.user_id AND savings_goal_activities.transaction_id = excluded.transaction_id
      AND savings_goal_activities.savings_goal_id = excluded.savings_goal_id AND savings_goal_activities.deleted = 0`,
  contribution.activity_id, userId, contribution.savings_goal_id, transactionId, amountCentavos, activityDate, notes, ts, ts);
  if (result.changes !== 1) throw new LocalDbError("VALIDATION_ERROR", "The contribution is unavailable.");
}
