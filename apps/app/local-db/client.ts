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
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(
  migrations: Migration[],
): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (!dbPromise) {
    dbPromise = (async () => {
      const opened = await SQLite.openDatabaseAsync("odin.db");
      await opened.execAsync(MIGRATIONS_TABLE);
      await runMigrations(opened, migrations);
      db = opened;
      return opened;
    })();
  }
  return dbPromise;
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
  const { default: m004 } = await import("./migrations/004_sync_failure_message");
  const { default: m005 } = await import("./migrations/005_sync_discarded_at");
  const { default: m006 } = await import("./migrations/006_financial_foundations");
  const { default: m007 } = await import("./migrations/007_estimated_interval");
  const { default: m008 } = await import("./migrations/008_second_day_of_week");
  const { default: m009 } = await import("./migrations/009_obligation_due_fields");
  const { default: m010 } = await import("./migrations/010_obligation_due_month");
  const { default: m011 } = await import("./migrations/011_financial_accounts");
  const { default: m012 } = await import("./migrations/012_ledger_tables");
  const { default: m013 } = await import("./migrations/013_dashboard_snapshots");
  const { default: m014 } = await import("./migrations/014_income_source_recurring_links");
  const { default: m015 } = await import("./migrations/015_sync_pending");
  const { default: m016 } = await import("./migrations/016_budget_drafts");
  const { default: m017 } = await import("./migrations/017_budget_debt_envelope");
  const { default: m018 } = await import("./migrations/018_debt_management");
  const { default: m019 } = await import("./migrations/019_debt_payment_schedule");
  const { default: m020 } = await import("./migrations/020_reconcile_budget_debt_migrations");
  return getDatabase([m001, m002, m003, m004, m005, m006, m007, m008, m009, m010, m011, m012, m013, m014, m015, m016, m017, m018, m019, m020]);
}

export function closeDatabase(): Promise<void> {
  if (!db) return Promise.resolve();
  const d = db;
  db = null;
  dbPromise = null;
  return d.closeAsync();
}
