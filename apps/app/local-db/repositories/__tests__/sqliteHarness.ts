import { jest } from "@jest/globals";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import syncTables from "../../migrations/001_sync_tables";

// Real in-memory SQLite (node:sqlite) behind the expo-sqlite async methods the repositories use.
export function createSqliteHarness() {
  const sqlite = new DatabaseSync(":memory:");
  const params = (values: unknown[]) => values.flat() as SQLInputValue[];
  const db = {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    getFirstAsync: async (sql: string, ...values: unknown[]) => sqlite.prepare(sql).get(...params(values)) ?? null,
    getAllAsync: async (sql: string, ...values: unknown[]) => sqlite.prepare(sql).all(...params(values)),
    runAsync: async (sql: string, ...values: unknown[]) => sqlite.prepare(sql).run(...params(values)),
    withTransactionAsync: async (work: () => Promise<void>) => {
      sqlite.exec("BEGIN");
      try { await work(); sqlite.exec("COMMIT"); } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  return {
    sqlite,
    db,
    async migrate(...migrations: { up: (db: never) => Promise<void> }[]) {
      for (const migration of [syncTables, ...migrations]) await migration.up(db as never);
    },
    // The app's full local schema, for tests that exercise the real ledger.
    async migrateAll() {
      const { loadMigrations } = jest.requireActual<typeof import("../../client")>("../../client");
      // Jest's ESM interop wraps each dynamically imported migration in one more default.
      const migrations = (await loadMigrations()).map((loaded) => "up" in loaded ? loaded : (loaded as unknown as { default: typeof loaded }).default);
      for (const migration of migrations.sort((a, b) => a.version - b.version)) {
        // 061 and 071 still read category_groups, which 002 no longer creates; recreate what older devices had.
        if (migration.version === 61) sqlite.exec("CREATE TABLE category_groups (id text primary key, slug text); ALTER TABLE categories ADD COLUMN category_group_id text;");
        await migration.up(db as never);
      }
    },
    queued(entity: string) {
      const rows = sqlite.prepare("SELECT record_id, operation_type, changed_fields, payload FROM sync_queue WHERE entity = ? ORDER BY rowid").all(entity) as { record_id: string; operation_type: string; changed_fields: string; payload: string }[];
      return rows.map((row) => ({ ...row, changed_fields: JSON.parse(row.changed_fields) as string[], payload: JSON.parse(row.payload) as Record<string, unknown> }));
    },
  };
}
