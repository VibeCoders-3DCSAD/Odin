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
const MAX_PULL_PAGES_PER_SYNC = 3;
const PULL_PAGE_DELAY_MS = 100;

const syncPromises = new Map<string, Promise<SyncResult>>();

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
  successful: boolean;
  hasMore: boolean;
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

type IncomeSourceSyncFields = {
  recurring_template_id: string | null;
  destination_account_id: string | null;
  subcategory_id: string | null;
};


export async function runSync(
  userId: string,
  deviceId: string,
  accessToken: string,
  options: RunSyncOptions = {},
): Promise<SyncResult> {
  const syncKey = `${userId}:${deviceId}`;
  const existing = syncPromises.get(syncKey);
  if (existing) return existing;

  const syncPromise = runSyncInternal(userId, deviceId, accessToken, options);
  syncPromises.set(syncKey, syncPromise);
  try {
    return await syncPromise;
  } finally {
    if (syncPromises.get(syncKey) === syncPromise) syncPromises.delete(syncKey);
  }
}

async function runSyncInternal(
  userId: string,
  deviceId: string,
  accessToken: string,
  options: RunSyncOptions,
): Promise<SyncResult> {
  if (!userId || !accessToken || !deviceId) {
    return { pushed: 0, pulled: 0, errors: 0, successful: false, hasMore: false };
  }

  const db = await initDatabase();

  const syncState = await loadSyncState(db, userId);
  const cursors = syncState.cursors;
  await resetTaxonomyCursorsIfEmpty(db, userId, cursors);

  try {
    await ensureDeviceRegistered(db, userId, deviceId, accessToken);
  } catch {
    return { pushed: 0, pulled: 0, errors: 0, successful: false, hasMore: syncState.pullPending };
  }

  const { pushed, errors } = await pushQueue(db, userId, deviceId, accessToken, options.maxAttempts);

  let pulled = 0;
  let pullSuccessful = true;
  let hasMore = syncState.pullPending;

  for (let page = 0; page < MAX_PULL_PAGES_PER_SYNC; page++) {
    const previousHasMore = hasMore;
    let result: Awaited<ReturnType<typeof pullAndApply>>;

    try {
      result = await pullAndApply(db, userId, accessToken, cursors);
    } catch {
      pullSuccessful = false;
      hasMore = true;
      break;
    }

    pulled += result.pulled;
    pullSuccessful = pullSuccessful && result.successful;
    Object.assign(cursors, result.cursors);
    hasMore = result.successful ? result.hasMore : previousHasMore || result.hasMore;

    if (!result.successful || !result.hasMore) break;
    if (page < MAX_PULL_PAGES_PER_SYNC - 1) {
      await new Promise((resolve) => setTimeout(resolve, PULL_PAGE_DELAY_MS));
    }
  }

  await saveCursors(db, userId, deviceId, cursors, hasMore);

  return { pushed, pulled, errors, successful: pullSuccessful && errors === 0, hasMore };
}

async function resetTaxonomyCursorsIfEmpty(
  db: SQLite.SQLiteDatabase,
  userId: string,
  cursors: Record<string, TableCursor>,
): Promise<void> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM categories WHERE user_id = ? AND deleted = 0",
    userId,
  );
  if ((row?.count ?? 0) > 0) return;

  delete cursors.category_groups;
  delete cursors.categories;
  delete cursors.subcategories;
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

  await repairIncomeSourceSyncRows(db, rows);

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

async function repairIncomeSourceSyncRows(
  db: SQLite.SQLiteDatabase,
  rows: QueueRow[],
): Promise<void> {
  for (const row of rows) {
    if (row.entity !== "income_sources") continue;
    if (row.operation_type !== "create" && row.operation_type !== "update") continue;

    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    const changedFields = JSON.parse(row.changed_fields) as string[];

    const needsRepair =
      payload.destination_account_id == null ||
      payload.subcategory_id == null ||
      payload.recurring_template_id == null;

    if (!needsRepair) continue;

    const localRow = await db.getFirstAsync<IncomeSourceSyncFields>(
      `SELECT recurring_template_id, destination_account_id, subcategory_id
       FROM income_sources WHERE id = ?`,
      row.record_id,
    );

    if (!localRow) continue;

    let touched = false;

    if (payload.destination_account_id == null && localRow.destination_account_id) {
      payload.destination_account_id = localRow.destination_account_id;
      if (!changedFields.includes("destination_account_id")) changedFields.push("destination_account_id");
      touched = true;
    }

    if (payload.subcategory_id == null && localRow.subcategory_id) {
      payload.subcategory_id = localRow.subcategory_id;
      if (!changedFields.includes("subcategory_id")) changedFields.push("subcategory_id");
      touched = true;
    }

    if (payload.recurring_template_id == null && localRow.recurring_template_id) {
      payload.recurring_template_id = localRow.recurring_template_id;
      if (!changedFields.includes("recurring_template_id")) changedFields.push("recurring_template_id");
      touched = true;
    }

    if (!touched) continue;

    row.payload = JSON.stringify(payload);
    row.changed_fields = JSON.stringify(changedFields);

    await db.runAsync(
      "UPDATE sync_queue SET payload = ?, changed_fields = ? WHERE operation_id = ?",
      row.payload,
      row.changed_fields,
      row.operation_id,
    );
  }
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
): Promise<{ pulled: number; cursors: Record<string, TableCursor>; successful: boolean; hasMore: boolean }> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE}/odin/api/sync/pull?cursors=${encodeURIComponent(JSON.stringify(cursors))}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Cache-Control": "no-cache",
        },
      },
    );
  } catch {
    return { pulled: 0, cursors, successful: false, hasMore: false };
  }

  if (!response.ok) return { pulled: 0, cursors, successful: false, hasMore: false };

  const body = await response.json();
  const payload = body?.payload as {
    cursors: Record<string, TableCursor>;
    changes: Record<string, Record<string, unknown>[]>;
    has_more?: Record<string, boolean>;
    successful: boolean;
  } | null;

  if (!payload?.changes) {
    return { pulled: 0, cursors: payload?.cursors ?? cursors, successful: false, hasMore: false };
  }

  let pulled = 0;

  for (const table of SYNCED_TABLES) {
    const rows = payload.changes[table];
    if (!rows || rows.length === 0) continue;

    for (const row of rows) {
      const normalized = normalizePullRow(table, row as Record<string, unknown>, userId);
      try {
        await applyPullRow(db, table, normalized);
        pulled++;
      } catch (error) {
        console.error("[sync/pull] local apply failed", {
          table,
          recordId: row.id,
          reason: error instanceof Error ? error.message : "unknown error",
        });
        throw error;
      }
    }
  }

  const hasMore = payload.has_more
    ? Object.values(payload.has_more).some(Boolean)
    : Object.values(payload.changes).some((rows) => rows.length === 500);

  return { pulled, cursors: payload.cursors, successful: payload.successful !== false, hasMore };
}

async function loadSyncState(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<{ cursors: Record<string, TableCursor>; pullPending: boolean }> {
  const row = await db.getFirstAsync<{ pull_cursor: string | null; pull_pending: number | null }>(
    "SELECT pull_cursor, pull_pending FROM sync_state WHERE user_id = ?",
    userId,
  );
  if (!row?.pull_cursor) return { cursors: {}, pullPending: row?.pull_pending === 1 };
  try {
    return { cursors: JSON.parse(row.pull_cursor), pullPending: row.pull_pending === 1 };
  } catch {
    return { cursors: {}, pullPending: row.pull_pending === 1 };
  }
}

async function saveCursors(
  db: SQLite.SQLiteDatabase,
  userId: string,
  deviceId: string,
  cursors: Record<string, TableCursor>,
  pullPending: boolean,
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_state
     (user_id, device_id, pull_cursor, pull_pending, last_sync_at)
     VALUES (?, ?, ?, ?, ?)`,
    userId,
    deviceId,
    JSON.stringify(cursors),
    pullPending ? 1 : 0,
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
