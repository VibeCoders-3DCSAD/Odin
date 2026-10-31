import type { SQLiteDatabase } from "expo-sqlite";
import { initDatabase } from "../../client";

// Kept apart from local-db/helpers.ts: repository tests replace that module with a factory that lists
// only enqueueOperation and LocalDbError, so these would vanish under those mocks.
export function getDb(): Promise<SQLiteDatabase> {
  return initDatabase();
}

export function now(): string {
  return new Date().toISOString();
}

export function boolToInt(v: boolean | undefined | null): number {
  return v ? 1 : 0;
}
