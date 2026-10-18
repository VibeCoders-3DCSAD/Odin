import type { Migration } from "../client";

// Billers and remittances no longer require a category. SQLite cannot drop NOT NULL in place, so the table is rebuilt.
const COLUMNS = `id, user_id, name, subcategory_id, source_account_id, amount_centavos, frequency, due_day_of_month,
  due_second_day_of_month, due_day_of_week, due_month, starts_on, ends_on, auto_post, auto_post_from, is_family_support,
  is_dependent_support, protected_by_default, notes, status, version, deleted, created_at, updated_at, last_synced_at`;

const migration: Migration = {
  version: 82,
  up: async (db) => {
    // A rebuild interrupted after the rename leaves only the old copy behind; resume from it.
    const old = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'scheduled_payments_old'");
    if (old) await db.execAsync("DROP TABLE IF EXISTS scheduled_payments");
    else await db.execAsync("ALTER TABLE scheduled_payments RENAME TO scheduled_payments_old");
    await db.execAsync(`
      DROP INDEX IF EXISTS idx_scheduled_payments_user;
      CREATE TABLE scheduled_payments (
        id text primary key,
        user_id text not null,
        name text not null,
        subcategory_id text,
        source_account_id text not null,
        amount_centavos integer not null,
        frequency text not null,
        due_day_of_month integer,
        due_second_day_of_month integer,
        due_day_of_week integer,
        due_month integer,
        starts_on text not null,
        ends_on text,
        auto_post integer not null default 0,
        auto_post_from text,
        is_family_support integer not null default 0,
        is_dependent_support integer not null default 0,
        protected_by_default integer not null default 1,
        notes text,
        status text not null default 'active',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
      INSERT INTO scheduled_payments (${COLUMNS}) SELECT ${COLUMNS} FROM scheduled_payments_old;
      DROP TABLE scheduled_payments_old;
      CREATE INDEX IF NOT EXISTS idx_scheduled_payments_user ON scheduled_payments (user_id, deleted, status);
    `);
  },
};

export default migration;
