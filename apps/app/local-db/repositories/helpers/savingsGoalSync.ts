import type { SQLiteDatabase } from "expo-sqlite";

export async function repairUnlinkedGoalCreate(
  db: SQLiteDatabase,
  userId: string,
  goalId: string,
  accountId: string,
): Promise<void> {
  // A goal created offline by an older app must acquire its link before its
  // original create operation can sync. Preserve every other queued value.
  await db.runAsync(`UPDATE sync_queue SET
    payload = json_set(payload, '$.linked_account_id', ?),
    changed_fields = CASE WHEN EXISTS (
      SELECT 1 FROM json_each(sync_queue.changed_fields) WHERE value = 'linked_account_id'
    ) THEN changed_fields ELSE json_insert(changed_fields, '$[#]', 'linked_account_id') END,
    status = 'pending', attempts = 0, last_error = NULL
    WHERE user_id = ? AND entity = 'savings_goals' AND record_id = ?
      AND operation_type = 'create' AND status IN ('pending', 'failed')
      AND json_extract(payload, '$.linked_account_id') IS NULL`, accountId, userId, goalId);
}
