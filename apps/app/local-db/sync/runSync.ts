import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import {
  normalizePullRow,
  applyPullRow,
  SYNCED_TABLES,
} from "./pullConvergence";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const REQUEST_TIMEOUT = 10_000;
const MAX_SYNC_ATTEMPTS = 3;

let syncRunning = false;

type TableCursor = { ts: string; id: string };

type PushResultItem = {
  operation_id: string;
  status: "applied" | "rejected" | "duplicate";
  reason?: string;
  current_version?: number;
};

type SyncResult = {
  pushed: number;
  pulled: number;
  errors: number;
};

type RunSyncOptions = {
  maxAttempts?: number;
};

type QueueRow = {
  operation_id: string;
  user_id: string;
  device_id: string;
  entity: string;
  record_id: string;
  operation_type: string;
  base_version: number | null;
  changed_fields: string;
  payload: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
};

export async function runSync(
  userId: string,
  deviceId: string,
  accessToken: string,
  options: RunSyncOptions = {},
): Promise<SyncResult> {
  if (!userId || !accessToken || !deviceId) {
    return { pushed: 0, pulled: 0, errors: 0 };
  }
  if (syncRunning) return { pushed: 0, pulled: 0, errors: 0 };

  syncRunning = true;
  try {
    const db = await initDatabase();

    const cursors = await loadCursors(db, userId);

    try {
      await ensureDeviceRegistered(db, userId, deviceId, accessToken);
    } catch {
      return { pushed: 0, pulled: 0, errors: 0 };
    }

    const { pushed, errors } = await pushQueue(db, userId, deviceId, accessToken, options.maxAttempts);

    const { pulled, cursors: newCursors } = await pullAndApply(
      db,
      userId,
      accessToken,
      cursors,
    );

    await saveCursors(db, userId, deviceId, newCursors);

    return { pushed, pulled, errors };
  } finally {
    syncRunning = false;
  }
}

async function pushQueue(
  db: SQLite.SQLiteDatabase,
  userId: string,
  deviceId: string,
  accessToken: string,
  maxAttempts?: number,
): Promise<{ pushed: number; errors: number }> {
  const rows = await db.getAllAsync<QueueRow>(
    `SELECT * FROM sync_queue
     WHERE user_id = ? AND device_id = ?
       AND status IN ('pending', 'failed')
       ${maxAttempts === undefined ? "" : "AND attempts < ?"}
     ORDER BY created_at LIMIT 50`,
    userId,
    deviceId,
    ...(maxAttempts === undefined ? [] : [maxAttempts]),
  );

  if (rows.length === 0) return { pushed: 0, errors: 0 };

  const operations = rows.map((r) => ({
    operation_id: r.operation_id,
    entity: r.entity,
    record_id: r.record_id,
    operation_type: r.operation_type,
    base_version: r.base_version,
    changed_fields: JSON.parse(r.changed_fields),
    payload: JSON.parse(r.payload),
  }));

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE}/odin/api/sync/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ payload: { device_id: deviceId, operations } }),
    });
  } catch {
    await bumpQueueAttempts(db, userId, deviceId, rows, "network error");
    return { pushed: 0, errors: rows.length };
  }

  if (!response.ok) {
    await bumpQueueAttempts(db, userId, deviceId, rows, `server error: ${response.status}`);
    return { pushed: 0, errors: rows.length };
  }

  const body = await response.json();
  const results = (body?.payload?.results ?? []) as PushResultItem[];

  let pushed = 0;
  let errors = 0;

  for (const result of results) {
    if (result.status === "applied" || result.status === "duplicate") {
      await db.runAsync(
        "UPDATE sync_queue SET status = 'synced' WHERE operation_id = ?",
        result.operation_id,
      );
      pushed++;
    } else {
      await db.runAsync(
        `UPDATE sync_queue SET status = 'failed', attempts = attempts + 1,
         last_error = ? WHERE operation_id = ?`,
        result.reason ?? "unknown error",
        result.operation_id,
      );
      errors++;
    }
  }

  return { pushed, errors };
}

async function bumpQueueAttempts(
  db: SQLite.SQLiteDatabase,
  userId: string,
  deviceId: string,
  rows: QueueRow[],
  error: string,
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `UPDATE sync_queue
       SET attempts = attempts + 1, last_error = ?,
           status = CASE WHEN attempts + 1 >= ? THEN 'failed' ELSE status END
       WHERE operation_id = ? AND user_id = ? AND device_id = ?`,
      error,
      MAX_SYNC_ATTEMPTS,
      row.operation_id,
      userId,
      deviceId,
    );
  }
}

async function pullAndApply(
  db: SQLite.SQLiteDatabase,
  userId: string,
  accessToken: string,
  cursors: Record<string, TableCursor>,
): Promise<{ pulled: number; cursors: Record<string, TableCursor> }> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE}/odin/api/sync/pull?cursors=${encodeURIComponent(JSON.stringify(cursors))}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  } catch {
    return { pulled: 0, cursors };
  }

  if (!response.ok) return { pulled: 0, cursors };

  const body = await response.json();
  const payload = body?.payload as {
    cursors: Record<string, TableCursor>;
    changes: Record<string, Record<string, unknown>[]>;
  } | null;

  if (!payload?.changes) return { pulled: 0, cursors: payload?.cursors ?? cursors };

  let pulled = 0;

  for (const table of SYNCED_TABLES) {
    const rows = payload.changes[table];
    if (!rows || rows.length === 0) continue;

    for (const row of rows) {
      const normalized = normalizePullRow(table, row as Record<string, unknown>, userId);
      await applyPullRow(db, table, normalized);
      pulled++;
    }
  }

  return { pulled, cursors: payload.cursors };
}

async function loadCursors(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<Record<string, TableCursor>> {
  const row = await db.getFirstAsync<{ pull_cursor: string | null }>(
    "SELECT pull_cursor FROM sync_state WHERE user_id = ?",
    userId,
  );
  if (!row?.pull_cursor) return {};
  try {
    return JSON.parse(row.pull_cursor);
  } catch {
    return {};
  }
}

async function saveCursors(
  db: SQLite.SQLiteDatabase,
  userId: string,
  deviceId: string,
  cursors: Record<string, TableCursor>,
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_state
     (user_id, device_id, pull_cursor, last_sync_at)
     VALUES (?, ?, ?, ?)`,
    userId,
    deviceId,
    JSON.stringify(cursors),
    new Date().toISOString(),
  );
}

async function ensureDeviceRegistered(
  db: SQLite.SQLiteDatabase,
  userId: string,
  deviceId: string,
  accessToken: string,
): Promise<void> {
  const existing = await db.getFirstAsync<{ device_id: string }>(
    "SELECT device_id FROM sync_state WHERE user_id = ?",
    userId,
  );
  if (existing?.device_id === deviceId) return;

  const response = await fetchWithTimeout(`${API_BASE}/odin/api/sync/register-device`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ payload: { device_id: deviceId } }),
  });

  if (!response.ok) {
    throw new Error(`device registration failed: ${response.status}`);
  }
}

function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number },
): Promise<Response> {
  const timeout = options.timeout ?? REQUEST_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId),
  );
}
