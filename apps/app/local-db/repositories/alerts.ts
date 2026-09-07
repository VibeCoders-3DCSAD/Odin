import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import type {
  Alert,
  AlertCachePageOptions,
  AlertCacheRecord,
} from "../../features/alerts/types";

const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const MAX_PAGE_SIZE = 50;
const ACTIVE_STATUSES = ["unread", "read", "acknowledged"] as const;

type AlertRow = Omit<AlertCacheRecord, "route_params" | "related_entities" | "metadata" | "stale"> & {
  route_params_json: string;
  related_entities_json: string;
  metadata_json: string;
  allowed_actions_json: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapAlert(row: AlertRow): AlertCacheRecord {
  return {
    ...row,
    route_params: parseJson(row.route_params_json, {}),
    related_entities: parseJson(row.related_entities_json, []),
    metadata: parseJson(row.metadata_json, {}),
    allowed_actions: parseJson(row.allowed_actions_json, []),
    stale: Date.now() - new Date(row.cached_at).getTime() > STALE_THRESHOLD_MS,
  };
}

function cacheValues(userId: string, alert: Alert, cachedAt: string): SQLite.SQLiteBindValue[] {
  return [
    alert.id,
    userId,
    alert.category,
    alert.severity,
    alert.status,
    alert.title,
    alert.body,
    alert.explanation,
    alert.action_label,
    alert.route_name,
    JSON.stringify(alert.route_params),
    JSON.stringify(alert.related_entities),
    JSON.stringify(alert.metadata),
    JSON.stringify(alert.allowed_actions),
    alert.remote_revision,
    alert.triggered_at,
    alert.read_at,
    alert.acknowledged_at,
    alert.dismissed_at,
    alert.remind_at,
    alert.expires_at,
    cachedAt,
  ];
}

const UPSERT = `INSERT INTO alert_cache
  (id, user_id, category, severity, status, title, body, explanation, action_label,
   route_name, route_params_json, related_entities_json, metadata_json, allowed_actions_json, remote_revision,
   triggered_at, read_at, acknowledged_at, dismissed_at, remind_at, expires_at, cached_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    user_id = excluded.user_id, category = excluded.category, severity = excluded.severity,
    status = excluded.status, title = excluded.title, body = excluded.body,
    explanation = excluded.explanation, action_label = excluded.action_label,
    route_name = excluded.route_name, route_params_json = excluded.route_params_json,
    related_entities_json = excluded.related_entities_json, metadata_json = excluded.metadata_json,
    allowed_actions_json = excluded.allowed_actions_json,
    remote_revision = excluded.remote_revision, triggered_at = excluded.triggered_at,
    read_at = excluded.read_at, acknowledged_at = excluded.acknowledged_at,
    dismissed_at = excluded.dismissed_at, remind_at = excluded.remind_at,
    expires_at = excluded.expires_at, cached_at = excluded.cached_at
  WHERE alert_cache.user_id = excluded.user_id`;

export async function replaceAlertPage(
  userId: string,
  alerts: Alert[],
  options: AlertCachePageOptions = {},
): Promise<void> {
  if (alerts.length > MAX_PAGE_SIZE) throw new Error(`alert page cannot exceed ${MAX_PAGE_SIZE} items`);
  const db = await getDb();
  const cachedAt = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    if (options.replace_before !== undefined) {
      await db.runAsync(
        `DELETE FROM alert_cache
         WHERE user_id = ? AND status IN (?, ?, ?)
           AND (? IS NULL OR (triggered_at <= ? AND triggered_at > COALESCE(?, '')))` ,
        userId,
        ...ACTIVE_STATUSES,
        options.replace_before,
        options.replace_before,
        options.cursor ?? "",
      );
    }
    for (const alert of alerts) {
      await db.runAsync(UPSERT, ...cacheValues(userId, alert, cachedAt));
    }
  });
}

export async function getActiveAlerts(userId: string, limit = MAX_PAGE_SIZE): Promise<AlertCacheRecord[]> {
  const db = await getDb();
  const boundedLimit = Math.max(1, Math.min(limit, MAX_PAGE_SIZE));
  const rows = await db.getAllAsync<AlertRow>(
    `SELECT * FROM alert_cache
     WHERE user_id = ? AND status IN (?, ?, ?)
     ORDER BY triggered_at DESC LIMIT ?`,
    userId,
    ...ACTIVE_STATUSES,
    boundedLimit,
  );
  return rows.map(mapAlert);
}

export async function getAlertDetail(userId: string, alertId: string): Promise<AlertCacheRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<AlertRow>(
    "SELECT * FROM alert_cache WHERE user_id = ? AND id = ?",
    userId,
    alertId,
  );
  return row ? mapAlert(row) : null;
}

export async function isAlertCacheStale(userId: string, alertId?: string): Promise<boolean> {
  const db = await getDb();
  const row = alertId
    ? await db.getFirstAsync<{ cached_at: string }>("SELECT cached_at FROM alert_cache WHERE user_id = ? AND id = ?", userId, alertId)
    : await db.getFirstAsync<{ cached_at: string }>("SELECT cached_at FROM alert_cache WHERE user_id = ? ORDER BY cached_at DESC LIMIT 1", userId);
  return !row || Date.now() - new Date(row.cached_at).getTime() > STALE_THRESHOLD_MS;
}

export function _resetDbCacheForTesting(): void {
  dbPromise = null;
}
