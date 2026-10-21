import type * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { LocalDbError } from "../helpers";
import { randomUUID } from "../uuid";

export type SavingsExpenseWithdrawal = { savings_goal_id: string; amount_centavos: number; id: string };
export type SavingsExpenseFunding = {
  accountId: string;
  unallocatedCentavos: number;
  requiredWithdrawalCentavos: number;
  existingShortfallCentavos: number;
  goals: { id: string; name: string; availableCentavos: number }[];
};

export async function readSavingsExpenseFunding(
  db: SQLite.SQLiteDatabase, userId: string, accountId: string, amountCentavos: number, transactionId?: string,
): Promise<SavingsExpenseFunding> {
  const account = await db.getFirstAsync<{ current_balance_centavos: number; kind: string }>(
    "SELECT current_balance_centavos, kind FROM financial_accounts WHERE user_id = ? AND id = ? AND deleted = 0",
    userId, accountId,
  );
  if (!account) throw new LocalDbError("VALIDATION_ERROR", "The source account is unavailable.");
  const previous = transactionId ? await db.getFirstAsync<{ amount_centavos: number; source_account_id: string | null; destination_account_id: string | null }>(
    "SELECT amount_centavos, source_account_id, destination_account_id FROM transactions WHERE user_id = ? AND id = ? AND (source_account_id = ? OR destination_account_id = ?) AND status = 'posted' AND deleted = 0",
    userId, transactionId, accountId, accountId,
  ) : null;
  // Archived goals still reserve their money. Existing expense withdrawals are
  // excluded so an edit chooses a replacement split against the original funds.
  const rows = account.kind === "credit_card" ? [] : await db.getAllAsync<{ id: string; name: string; availableCentavos: number }>(`
    SELECT g.id, g.name, MAX(0, g.starting_amount_centavos + COALESCE(SUM(
      CASE WHEN a.activity_kind = 'contribution' THEN a.amount_centavos ELSE -a.amount_centavos END
    ), 0)) AS availableCentavos
    FROM savings_goals g LEFT JOIN savings_goal_activities a
      ON a.savings_goal_id = g.id AND a.user_id = g.user_id AND a.deleted = 0
      AND (? IS NULL OR a.transaction_id <> ?)
    WHERE g.user_id = ? AND g.linked_account_id = ? AND g.deleted = 0
    GROUP BY g.id ORDER BY g.name COLLATE NOCASE, g.id`, transactionId ?? null, transactionId ?? null, userId, accountId);
  const reserved = rows.reduce((total, goal) => total + goal.availableCentavos, 0);
  const previousDebit = previous?.source_account_id === accountId ? previous.amount_centavos : 0;
  const previousCredit = previous?.destination_account_id === accountId ? previous.amount_centavos : 0;
  const balance = account.current_balance_centavos + previousDebit - previousCredit;
  const unallocatedCentavos = Math.max(0, balance - reserved);
  return {
    accountId, unallocatedCentavos,
    requiredWithdrawalCentavos: Math.min(reserved, Math.max(0, amountCentavos - unallocatedCentavos)),
    existingShortfallCentavos: Math.max(0, reserved - balance),
    goals: rows,
  };
}

export async function getSavingsExpenseFunding(userId: string, accountId: string, amountCentavos: number, transactionId?: string) {
  return readSavingsExpenseFunding(await initDatabase(), userId, accountId, amountCentavos, transactionId);
}

export function validateSavingsExpenseWithdrawals(funding: SavingsExpenseFunding, withdrawals: SavingsExpenseWithdrawal[]): void {
  if (!Array.isArray(withdrawals) || withdrawals.length > 100) throw new LocalDbError("VALIDATION_ERROR", "Select at most 100 savings goals.");
  const ids = new Set<string>();
  const activityIds = new Set<string>();
  let total = 0;
  for (const withdrawal of withdrawals) {
    const goal = funding.goals.find((item) => item.id === withdrawal.savings_goal_id);
    if (!goal || ids.has(goal.id) || activityIds.has(withdrawal.id) || !withdrawal.id || !Number.isSafeInteger(withdrawal.amount_centavos)
      || withdrawal.amount_centavos <= 0 || withdrawal.amount_centavos > goal.availableCentavos) {
      throw new LocalDbError("VALIDATION_ERROR", "Choose valid amounts within each linked goal's available savings.");
    }
    ids.add(goal.id); activityIds.add(withdrawal.id);
    total += withdrawal.amount_centavos;
  }
  if (!Number.isSafeInteger(total) || total !== funding.requiredWithdrawalCentavos) throw new LocalDbError("SAVINGS_FUNDING_REQUIRED", "Choose which savings goals cover the amount beyond your unallocated balance.");
}

export async function replaceExpenseSavingsWithdrawals(
  db: SQLite.SQLiteDatabase, userId: string, transactionId: string, withdrawals: SavingsExpenseWithdrawal[], activityDate: string, notes: string | null,
): Promise<SavingsExpenseWithdrawal[]> {
  const existing = await db.getAllAsync<{ id: string; savings_goal_id: string }>(
    "SELECT id, savings_goal_id FROM savings_goal_activities WHERE user_id = ? AND transaction_id = ? ORDER BY created_at", userId, transactionId,
  );
  const normalized = withdrawals.map((item) => ({ ...item, id: existing.find((row) => row.savings_goal_id === item.savings_goal_id)?.id ?? item.id }));
  const ts = new Date().toISOString();
  await db.runAsync("UPDATE savings_goal_activities SET deleted = 1, version = version + 1, updated_at = ? WHERE user_id = ? AND transaction_id = ? AND deleted = 0", ts, userId, transactionId);
  // These rows travel inside the transaction's sync payload so the server can
  // validate and apply the whole split in one database transaction.
  if (!normalized.length) return [];
  const values = normalized.flatMap((item) => [item.id, userId, item.savings_goal_id, transactionId, item.amount_centavos, activityDate, notes, ts, ts]);
  const written = await db.runAsync(`INSERT INTO savings_goal_activities
    (id, user_id, savings_goal_id, transaction_id, activity_kind, amount_centavos, activity_date, notes, version, deleted, created_at, updated_at)
    VALUES ${normalized.map(() => "(?, ?, ?, ?, 'withdrawal', ?, ?, ?, 1, 0, ?, ?)").join(",")}
    ON CONFLICT(id) DO UPDATE SET amount_centavos = excluded.amount_centavos, activity_date = excluded.activity_date,
      notes = excluded.notes, deleted = 0, version = savings_goal_activities.version + 1, updated_at = excluded.updated_at
    WHERE savings_goal_activities.user_id = excluded.user_id
      AND savings_goal_activities.transaction_id = excluded.transaction_id
      AND savings_goal_activities.savings_goal_id = excluded.savings_goal_id`, ...values);
  if (written.changes !== normalized.length) throw new LocalDbError("VALIDATION_ERROR", "Invalid savings withdrawal identity.");
  return normalized;
}

export function newSavingsExpenseWithdrawal(goalId: string, amountCentavos: number): SavingsExpenseWithdrawal {
  return { savings_goal_id: goalId, amount_centavos: amountCentavos, id: randomUUID() };
}
