import * as SQLite from "expo-sqlite";
import type { EnqueueInput, SyncOperation } from "./types";
import { randomUUID } from "./uuid";

export class LocalDbError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "LocalDbError";
  }
}

function generateOperationId(): string {
  return randomUUID();
}

export async function enqueueOperation(
  db: SQLite.SQLiteDatabase,
  input: EnqueueInput,
): Promise<SyncOperation> {
  const operationId = generateOperationId();
  const createdAt = new Date().toISOString();
  const changedFieldsJson = JSON.stringify(input.changedFields);
  const payloadJson = JSON.stringify(input.payload);

  await db.runAsync(
    `INSERT INTO sync_queue
      (operation_id, user_id, device_id, entity, record_id, operation_type,
       base_version, changed_fields, payload, failure_message, status, attempts, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
    operationId,
    input.userId,
    input.deviceId,
    input.entity,
    input.recordId,
    input.operationType,
    input.baseVersion,
    changedFieldsJson,
    payloadJson,
    input.failureMessage,
    createdAt,
  );

  return {
    operation_id: operationId,
    user_id: input.userId,
    device_id: input.deviceId,
    entity: input.entity,
    record_id: input.recordId,
    operation_type: input.operationType,
    base_version: input.baseVersion,
    changed_fields: input.changedFields,
    payload: input.payload,
    failure_message: input.failureMessage,
    status: "pending",
    attempts: 0,
    last_error: null,
    discarded_at: null,
    created_at: createdAt,
  };
}

export async function cleanupDiscardedSyncRows(db: SQLite.SQLiteDatabase): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.runAsync(
    "DELETE FROM sync_queue WHERE status = 'discarded' AND discarded_at IS NOT NULL AND discarded_at < ?",
    cutoff,
  );
}
