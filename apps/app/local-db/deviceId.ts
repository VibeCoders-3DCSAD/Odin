import { initDatabase } from "./client";

export async function getOrCreateDeviceId(): Promise<string> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<{ device_id: string | null }>(
    "SELECT device_id FROM sync_state WHERE device_id IS NOT NULL LIMIT 1",
  );
  if (row?.device_id) return row.device_id;
  const id = crypto.randomUUID();
  return id;
}
