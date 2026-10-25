import { initDatabase } from "../client";

// A user who has never pulled on this device, or whose last pull stopped with pages left, still has
// server data to page in before the local screens can be trusted.
export async function needsInitialSync(userId: string): Promise<boolean> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<{ pull_cursor: string | null; pull_pending: number | null }>(
    "SELECT pull_cursor, pull_pending FROM sync_state WHERE user_id = ?",
    userId,
  );
  return !row?.pull_cursor || row.pull_pending === 1;
}
