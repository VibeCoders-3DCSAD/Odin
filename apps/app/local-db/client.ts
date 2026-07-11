import * as SQLite from "expo-sqlite";

export type Migration = {
  version: number;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
};

const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS _migrations (
  version integer primary key,
  applied_at text not null default (datetime('now'))
);`;

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(
  migrations: Migration[],
): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("odin.db");
  await db.execAsync(MIGRATIONS_TABLE);
  await runMigrations(db, migrations);
  return db;
}

async function runMigrations(
  db: SQLite.SQLiteDatabase,
  migrations: Migration[],
): Promise<void> {
  const applied = await db.getAllAsync<{ version: number }>(
    "SELECT version FROM _migrations ORDER BY version",
  );
  const appliedVersions = new Set(applied.map((r) => r.version));

  for (const m of migrations.sort((a, b) => a.version - b.version)) {
    if (appliedVersions.has(m.version)) continue;
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.runAsync(
        "INSERT INTO _migrations (version) VALUES (?)",
        m.version,
      );
    });
  }
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const { default: m001 } = await import("./migrations/001_sync_tables");
  const { default: m002 } = await import("./migrations/002_taxonomy_tables");
  const { default: m003 } = await import("./migrations/003_privacy_settings");
  return getDatabase([m001, m002, m003]);
}

export function closeDatabase(): Promise<void> {
  if (!db) return Promise.resolve();
  const d = db;
  db = null;
  return d.closeAsync();
}
