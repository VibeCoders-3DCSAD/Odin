import { randomUUID } from "expo-crypto";
import { initDatabase } from "./client";

export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const db = await initDatabase();
    const row = await db.getFirstAsync<{ device_id: string | null }>(
      "SELECT device_id FROM sync_state WHERE device_id IS NOT NULL LIMIT 1",
    );
    if (row?.device_id) {
      return row.device_id;
    }
    const id = randomUUID();
    await db.runAsync(
      "INSERT OR REPLACE INTO sync_state (user_id, device_id, pull_cursor, last_sync_at) VALUES (?, ?, ?, ?)",
      "", id, "{}", new Date().toISOString(),
    );
    return id;
  } catch (err) {
    throw err;
  }
}
