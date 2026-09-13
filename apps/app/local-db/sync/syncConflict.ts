type SyncQueueDatabase = {
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
};

type SyncConflict = {
  operation_id: string;
  reason?: string;
  current_version?: number;
  conflicted_fields?: string[];
};

export async function markSyncConflict(
  db: SyncQueueDatabase,
  conflict: SyncConflict,
): Promise<void> {
  const metadata = JSON.stringify({
    reason: conflict.reason ?? "conflict",
    currentVersion: conflict.current_version ?? null,
    conflictedFields: conflict.conflicted_fields ?? [],
  });
  await db.runAsync(
    `UPDATE sync_queue SET status = 'failed', attempts = attempts + 1,
      last_error = ? WHERE operation_id = ?`,
    metadata,
    conflict.operation_id,
  );
}
