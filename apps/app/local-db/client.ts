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

export async function loadMigrations(): Promise<Migration[]> {
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
  const { default: m017 } = await import("./migrations/017_single_budget");
  const { default: m018 } = await import("./migrations/018_budget_debt_envelope");
  const { default: m019 } = await import("./migrations/019_debt_management");
  const { default: m020 } = await import("./migrations/020_debt_payment_schedule");
  const { default: m021 } = await import("./migrations/021_financial_profile_cache");
  const { default: m022 } = await import("./migrations/022_debt_paid_off_at");
  const { default: m023 } = await import("./migrations/023_debt_archived_at");
  const { default: m024 } = await import("./migrations/024_credit_cards");
  const { default: m025 } = await import("./migrations/025_credit_card_atomic_purchase");
  const { default: m026 } = await import("./migrations/026_credit_card_pull_convergence");
  const { default: m027 } = await import("./migrations/027_credit_card_payment_recognition");
  const { default: m028 } = await import("./migrations/028_credit_card_mutation_ids");
  const { default: m029 } = await import("./migrations/029_credit_card_pull_columns");
  const { default: m030 } = await import("./migrations/030_sync_pull_failures");
  const { default: m031 } = await import("./migrations/031_credit_card_pull_cycle_guard");
  const { default: m032 } = await import("./migrations/032_drop_account_credit_limit");
  const { default: m033 } = await import("./migrations/033_credit_card_day_of_month_columns");
  const { default: m034 } = await import("./migrations/034_credit_card_cycle_snapshot_identity");
  const { default: m035 } = await import("./migrations/035_alert_cache");
  const { default: m036 } = await import("./migrations/036_optional_credit_card_statements");
  const { default: m037 } = await import("./migrations/037_repair_credit_card_cycle_trigger");
  const { default: m038 } = await import("./migrations/038_credit_card_statement_dates");
  const { default: m039 } = await import("./migrations/039_edit_credit_card_statements");
  const { default: m040 } = await import("./migrations/040_validate_credit_card_statement_selection");
  const { default: m041 } = await import("./migrations/041_harden_credit_card_statements");
  const { default: m042 } = await import("./migrations/042_credit_card_installment_purchases");
  return [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010, m011, m012, m013, m014, m015, m016, m017, m018, m019, m020, m021, m022, m023, m024, m025, m026, m027, m028, m029, m030, m031, m032, m033, m034, m035, m036, m037, m038, m039, m040, m041, m042];
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  return getDatabase(await loadMigrations());
}

export function closeDatabase(): Promise<void> {
  if (!db) return Promise.resolve();
  const d = db;
  db = null;
  dbPromise = null;
  return d.closeAsync();
}
