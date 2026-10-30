import { initDatabase } from "../../../local-db/client";

type OdinDevTools = {
  seedFailedSyncRows: (count?: number) => Promise<void>;
  ageDiscardedSyncRows: (days?: number) => Promise<void>;
  countDiscardedSyncRows: () => Promise<number>;
};

type GlobalWithOdinDevTools = typeof globalThis & { odinDevTools?: OdinDevTools };

// Dev-only console helpers (globalThis.odinDevTools) for exercising the sync-issues sheet.
export function installSyncDevTools(userId: string, deviceId: string, onSeeded: () => Promise<unknown>) {
  const global = globalThis as GlobalWithOdinDevTools;
  global.odinDevTools = {
    ...global.odinDevTools,
    seedFailedSyncRows: async (count = 51) => {
      const db = await initDatabase();
      const createdAtBase = Date.now();

      for (let i = 0; i < count; i++) {
        await db.runAsync(
          `INSERT OR IGNORE INTO sync_queue
            (operation_id, user_id, device_id, entity, record_id, operation_type,
             base_version, changed_fields, payload, failure_message, status, attempts, last_error, created_at)
           VALUES (?, ?, ?, 'categories', ?, 'update', 1, '[]', '{}', ?, 'failed', 3, 'Test failed sync row', ?)`,
          `test-failed-${i}`,
          userId,
          deviceId,
          `test-record-${i}`,
          `This category "Test category ${i + 1}" could not be updated.`,
          new Date(createdAtBase + i).toISOString(),
        );
      }

      await onSeeded();
    },
    ageDiscardedSyncRows: async (days = 31) => {
      const db = await initDatabase();
      await db.runAsync(
        "UPDATE sync_queue SET discarded_at = datetime('now', ?) WHERE status = 'discarded'",
        `-${days} days`,
      );
    },
    countDiscardedSyncRows: async () => {
      const db = await initDatabase();
      const row = await db.getFirstAsync<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM sync_queue WHERE status = 'discarded'",
      );
      return row?.cnt ?? 0;
    },
  };
}
