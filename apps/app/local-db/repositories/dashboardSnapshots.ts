import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { randomUUID } from "../uuid";

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export type DashboardSnapshotSource =
  | "budget_health"
  | "alerts"
  | "savings_goals"
  | "debt_status"
  | "forecast";

export type DashboardSnapshot = {
  id: string;
  user_id: string;
  source: DashboardSnapshotSource;
  payload_json: string;
  updated_at: string;
};

export type DashboardSnapshotWithMeta = DashboardSnapshot & {
  stale: boolean;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = initDatabase();
  }
  return dbPromise;
}

export async function upsertSnapshot(
  userId: string,
  source: DashboardSnapshotSource,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO dashboard_snapshots (id, user_id, source, payload_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, source)
     DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    randomUUID(),
    userId,
    source,
    JSON.stringify(payload),
    now,
  );
}

export async function getSnapshot(
  userId: string,
  source: DashboardSnapshotSource,
): Promise<DashboardSnapshotWithMeta | null> {
  const db = await getDb();

  const row = await db.getFirstAsync<DashboardSnapshot>(
    `SELECT id, user_id, source, payload_json, updated_at
     FROM dashboard_snapshots
     WHERE user_id = ? AND source = ?`,
    userId,
    source,
  );

  if (!row) return null;

  return {
    ...row,
    stale: Date.now() - new Date(row.updated_at).getTime() > STALE_THRESHOLD_MS,
  };
}

export async function getAllSnapshots(
  userId: string,
): Promise<Record<DashboardSnapshotSource, DashboardSnapshotWithMeta | null>> {
  const db = await getDb();

  const rows = await db.getAllAsync<DashboardSnapshot>(
    `SELECT id, user_id, source, payload_json, updated_at
     FROM dashboard_snapshots
     WHERE user_id = ?`,
    userId,
  );

  const result: Record<string, DashboardSnapshotWithMeta | null> = {
    budget_health: null,
    alerts: null,
    savings_goals: null,
    debt_status: null,
    forecast: null,
  };

  for (const row of rows) {
    result[row.source] = {
      ...row,
      stale: Date.now() - new Date(row.updated_at).getTime() > STALE_THRESHOLD_MS,
    };
  }

  return result as Record<DashboardSnapshotSource, DashboardSnapshotWithMeta | null>;
}

export async function deleteSnapshot(
  userId: string,
  source: DashboardSnapshotSource,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "DELETE FROM dashboard_snapshots WHERE user_id = ? AND source = ?",
    userId,
    source,
  );
}

export function _resetDbCacheForTesting(): void {
  dbPromise = null;
}
