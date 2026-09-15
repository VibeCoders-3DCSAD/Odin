import * as SQLite from "expo-sqlite";
import type { SavingsActivity, SavingsActivityKind } from "../../features/savings-goals/types";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";

type Row = { id: string; savings_goal_id: string; transaction_id: string; activity_kind: SavingsActivityKind; amount_centavos: number; activity_date: string; notes: string | null; version: number };
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function getDb() { dbPromise ??= initDatabase(); return dbPromise; }
function map(row: Row): SavingsActivity { return { id: row.id, savingsGoalId: row.savings_goal_id, transactionId: row.transaction_id, kind: row.activity_kind, amountCentavos: row.amount_centavos, activityDate: row.activity_date, notes: row.notes, version: row.version }; }

export async function listSavingsGoalActivities(userId: string, savingsGoalId: string): Promise<SavingsActivity[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>("SELECT id, savings_goal_id, transaction_id, activity_kind, amount_centavos, activity_date, notes, version FROM savings_goal_activities WHERE user_id = ? AND savings_goal_id = ? AND deleted = 0 ORDER BY activity_date DESC, created_at DESC", userId, savingsGoalId);
  return rows.map(map);
}

export async function listSavingsGoalActivitiesByGoal(userId: string, savingsGoalIds: string[]): Promise<Map<string, SavingsActivity[]>> {
  const result = new Map<string, SavingsActivity[]>();
  if (!savingsGoalIds.length) return result;
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(`SELECT id, savings_goal_id, transaction_id, activity_kind, amount_centavos, activity_date, notes, version FROM savings_goal_activities WHERE user_id = ? AND deleted = 0 AND savings_goal_id IN (${savingsGoalIds.map(() => "?").join(",")}) ORDER BY activity_date DESC, created_at DESC`, userId, ...savingsGoalIds);
  for (const row of rows) result.set(row.savings_goal_id, [...(result.get(row.savings_goal_id) ?? []), map(row)]);
  return result;
}

export async function createSavingsGoalActivityInTransaction(db: SQLite.SQLiteDatabase, userId: string, deviceId: string, input: { savingsGoalId: string; transactionId: string; kind: SavingsActivityKind; amountCentavos: number; activityDate: string; notes?: string }): Promise<{ activity: SavingsActivity; operation: SyncOperation }> {
  if (!Number.isSafeInteger(input.amountCentavos) || input.amountCentavos <= 0) throw new LocalDbError("VALIDATION_ERROR", "Savings activity amount must be a positive whole number.");
  const goal = await db.getFirstAsync<{ id: string; status: string }>("SELECT id, status FROM savings_goals WHERE id = ? AND user_id = ? AND deleted = 0", input.savingsGoalId, userId);
  if (!goal || goal.status !== "active") throw new LocalDbError("VALIDATION_ERROR", "Savings activity requires an active savings goal.");
  const id = randomUUID(); const ts = new Date().toISOString();
  await db.runAsync("INSERT INTO savings_goal_activities (id, user_id, savings_goal_id, transaction_id, activity_kind, amount_centavos, activity_date, notes, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)", id, userId, input.savingsGoalId, input.transactionId, input.kind, input.amountCentavos, input.activityDate, input.notes ?? null, ts, ts);
  const payload = { savings_goal_id: input.savingsGoalId, transaction_id: input.transactionId, activity_kind: input.kind, amount_centavos: input.amountCentavos, activity_date: input.activityDate, notes: input.notes ?? null };
  const operation = await enqueueOperation(db, { userId, deviceId, entity: "savings_goal_activities", recordId: id, operationType: "create", baseVersion: null, changedFields: Object.keys(payload), payload, failureMessage: "This savings activity could not be recorded." });
  return { activity: { id, savingsGoalId: input.savingsGoalId, transactionId: input.transactionId, kind: input.kind, amountCentavos: input.amountCentavos, activityDate: input.activityDate, notes: input.notes ?? null, version: 1 }, operation };
}

export async function updateSavingsGoalActivityForTransactionInTransaction(db: SQLite.SQLiteDatabase, userId: string, deviceId: string, transactionId: string, input: { amountCentavos: number; activityDate: string; notes: string | null }): Promise<void> {
  const activity = await db.getFirstAsync<Row>("SELECT id, savings_goal_id, transaction_id, activity_kind, amount_centavos, activity_date, notes, version FROM savings_goal_activities WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, transactionId);
  if (!activity) return;
  const changedFields = [
    ...(activity.amount_centavos === input.amountCentavos ? [] : ["amount_centavos"]),
    ...(activity.activity_date === input.activityDate ? [] : ["activity_date"]),
    ...(activity.notes === input.notes ? [] : ["notes"]),
  ];
  if (!changedFields.length) return;
  const ts = new Date().toISOString();
  await db.runAsync("UPDATE savings_goal_activities SET amount_centavos = ?, activity_date = ?, notes = ?, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", input.amountCentavos, input.activityDate, input.notes, ts, activity.id, userId);
  await enqueueOperation(db, { userId, deviceId, entity: "savings_goal_activities", recordId: activity.id, operationType: "update", baseVersion: activity.version, changedFields, payload: Object.fromEntries(changedFields.map((field) => [field, field === "amount_centavos" ? input.amountCentavos : field === "activity_date" ? input.activityDate : input.notes])), failureMessage: "This savings activity could not be updated." });
}

export async function deleteSavingsGoalActivityForTransactionInTransaction(db: SQLite.SQLiteDatabase, userId: string, deviceId: string, transactionId: string): Promise<void> {
  const activity = await db.getFirstAsync<Row>("SELECT id, savings_goal_id, transaction_id, activity_kind, amount_centavos, activity_date, notes, version FROM savings_goal_activities WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, transactionId);
  if (!activity) return;
  const ts = new Date().toISOString();
  await db.runAsync("UPDATE savings_goal_activities SET deleted = 1, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", ts, activity.id, userId);
  await enqueueOperation(db, { userId, deviceId, entity: "savings_goal_activities", recordId: activity.id, operationType: "delete", baseVersion: activity.version, changedFields: [], payload: {}, failureMessage: "This savings activity could not be deleted." });
}

export async function deleteSavingsGoalActivity(userId: string, deviceId: string, id: string): Promise<void> {
  const db = await getDb(); const ts = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const activity = await db.getFirstAsync<Row>("SELECT id, savings_goal_id, transaction_id, activity_kind, amount_centavos, activity_date, notes, version FROM savings_goal_activities WHERE id = ? AND user_id = ? AND deleted = 0", id, userId);
    if (!activity) throw new LocalDbError("NOT_FOUND", "Savings activity not found.");
    await db.runAsync("UPDATE savings_goal_activities SET deleted = 1, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", ts, id, userId);
    await enqueueOperation(db, { userId, deviceId, entity: "savings_goal_activities", recordId: id, operationType: "delete", baseVersion: activity.version, changedFields: [], payload: {}, failureMessage: "This savings activity could not be deleted." });
  });
}
