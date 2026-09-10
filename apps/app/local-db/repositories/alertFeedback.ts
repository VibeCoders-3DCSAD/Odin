import { initDatabase } from "../client";
import type * as SQLite from "expo-sqlite";
import { enqueueOperation } from "../helpers";
import { randomUUID } from "../uuid";
import type { SyncableEntity } from "../types";

type FeedbackEntity = Extract<SyncableEntity, "alert_notification_preferences" | "anomaly_whitelist_rules" | "alert_suppression_rules">;
const FEEDBACK_ENTITIES = new Set<FeedbackEntity>(["alert_notification_preferences", "anomaly_whitelist_rules", "alert_suppression_rules"]);

type FeedbackInput = {
  id?: string;
  values: Record<string, unknown>;
  baseVersion?: number | null;
};

export async function saveAlertFeedback(
  userId: string,
  deviceId: string,
  entity: FeedbackEntity,
  input: FeedbackInput,
) {
  if (!FEEDBACK_ENTITIES.has(entity)) throw new Error("unsupported alert feedback entity");
  const db = await initDatabase();
  const id = input.id ?? randomUUID();
  const existing = input.id
    ? await db.getFirstAsync<{ version: number }>(`SELECT version FROM ${entity} WHERE id = ? AND user_id = ? AND deleted = 0`, id, userId)
    : null;
  const operationType = existing ? "update" : "create";
  const now = new Date().toISOString();
  const values: Record<string, SQLite.SQLiteBindValue> = { ...(input.values as Record<string, SQLite.SQLiteBindValue>), id, user_id: userId, version: existing ? existing.version + 1 : 1, deleted: 0, updated_at: now };
  const columns = Object.keys(values);
  await db.withTransactionAsync(async () => {
    if (existing) {
      await db.runAsync(`UPDATE ${entity} SET ${columns.filter((column) => column !== "id" && column !== "user_id").map((column) => `${column} = ?`).join(", ")} WHERE id = ? AND user_id = ?`, ...columns.filter((column) => column !== "id" && column !== "user_id").map((column) => values[column] ?? null), id, userId);
    } else {
      await db.runAsync(`INSERT INTO ${entity} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, ...columns.map((column) => values[column] ?? null));
    }
    await enqueueOperation(db, { userId, deviceId, entity, recordId: id, operationType, baseVersion: input.baseVersion ?? existing?.version ?? null, changedFields: Object.keys(input.values), payload: input.values, failureMessage: "This alert preference could not be saved." });
  });
  return id;
}

export async function deleteAlertFeedback(userId: string, deviceId: string, entity: FeedbackEntity, id: string, baseVersion: number): Promise<void> {
  if (!FEEDBACK_ENTITIES.has(entity)) throw new Error("unsupported alert feedback entity");
  const db = await initDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE ${entity} SET deleted = 1, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ? AND deleted = 0`, new Date().toISOString(), id, userId);
    await enqueueOperation(db, { userId, deviceId, entity, recordId: id, operationType: "delete", baseVersion, changedFields: [], payload: {}, failureMessage: "This alert preference could not be deleted." });
  });
}
