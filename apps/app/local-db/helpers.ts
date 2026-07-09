import * as SQLite from "expo-sqlite";
import type { EnqueueInput, SyncOperation } from "./types";

function generateOperationId(): string {
  return crypto.randomUUID();
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
       base_version, changed_fields, payload, status, attempts, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
    operationId,
    input.userId,
    input.deviceId,
    input.entity,
    input.recordId,
    input.operationType,
    input.baseVersion,
    changedFieldsJson,
    payloadJson,
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
    status: "pending",
    attempts: 0,
    last_error: null,
    created_at: createdAt,
  };
}
