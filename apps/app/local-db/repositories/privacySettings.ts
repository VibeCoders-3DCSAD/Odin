import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import type { PrivacySettings } from "../../features/governance/types";
import type { ProfileAssignment } from "../../features/onboarding/types";

type PrivacySettingsRow = {
  id: string;
  user_id: string;
  personalization_enabled: number;
  model_training_opt_in: number;
  research_evaluation_opt_in: number;
  notifications_opt_in: number;
  data_retention_days: number | null;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

function mapRow(row: PrivacySettingsRow): PrivacySettings {
  return {
    personalization_enabled: row.personalization_enabled === 1,
    model_training_opt_in: row.model_training_opt_in === 1,
    research_evaluation_opt_in: row.research_evaluation_opt_in === 1,
    notifications_opt_in: row.notifications_opt_in === 1,
    data_retention_days: row.data_retention_days,
  };
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function settingsId(userId: string): string {
  return `${userId}:privacy`;
}

function now(): string {
  return new Date().toISOString();
}

export async function getLocalPrivacySettings(
  userId: string,
): Promise<PrivacySettings | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PrivacySettingsRow>(
    "SELECT * FROM privacy_settings WHERE user_id = ? AND deleted = 0",
    userId,
  );
  if (!row) return null;
  return mapRow(row);
}

export async function cachePrivacySettings(
  userId: string,
  settings: PrivacySettings,
): Promise<void> {
  const db = await getDb();
  const id = settingsId(userId);
  const ts = now();
  const existing = await db.getFirstAsync<{ version: number }>(
    "SELECT version FROM privacy_settings WHERE id = ?",
    id,
  );
  const version = (existing?.version ?? 0) + 1;

  await db.runAsync(
    `INSERT OR REPLACE INTO privacy_settings
     (id, user_id, personalization_enabled, model_training_opt_in,
      research_evaluation_opt_in, notifications_opt_in, data_retention_days,
      version, deleted, created_at, updated_at, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    id,
    userId,
    settings.personalization_enabled ? 1 : 0,
    settings.model_training_opt_in ? 1 : 0,
    settings.research_evaluation_opt_in ? 1 : 0,
    settings.notifications_opt_in ? 1 : 0,
    settings.data_retention_days,
    version,
    ts,
    ts,
    ts,
  );
}

export async function getLocalProfileAssignment(userId: string): Promise<ProfileAssignment | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ assignment_json: string }>(
    "SELECT assignment_json FROM financial_profile_cache WHERE user_id = ?",
    userId,
  );
  if (!row) return null;
  try {
    return JSON.parse(row.assignment_json) as ProfileAssignment;
  } catch {
    return null;
  }
}

export async function cacheProfileAssignment(userId: string, assignment: ProfileAssignment | null): Promise<void> {
  const db = await getDb();
  if (!assignment) {
    await db.runAsync("DELETE FROM financial_profile_cache WHERE user_id = ?", userId);
    return;
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO financial_profile_cache (user_id, assignment_json, updated_at)
     VALUES (?, ?, ?)`,
    userId,
    JSON.stringify(assignment),
    now(),
  );
}
