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
    queued(entity: string) {
      return sqlite.prepare("SELECT record_id, operation_type, changed_fields, payload FROM sync_queue WHERE entity = ? ORDER BY rowid").all(entity)
        .map((row) => ({ ...row, changed_fields: JSON.parse(String(row.changed_fields)), payload: JSON.parse(String(row.payload)) }));
    },
  };
}
