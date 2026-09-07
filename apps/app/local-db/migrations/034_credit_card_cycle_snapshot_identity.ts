import type { Migration } from "../client";

const migration: Migration = {
  version: 34,
  up: async (db) => {
    await db.execAsync(`
      DROP INDEX IF EXISTS idx_cc_cycles_account;
      ALTER TABLE credit_card_cycles RENAME TO credit_card_cycles_old;
      CREATE TABLE credit_card_cycles (
        id text primary key, user_id text not null, account_id text not null, cycle_start_date text not null,
        cutoff_date text not null, statement_date text not null, version integer not null default 1,
        deleted integer not null default 0, created_at text not null, updated_at text not null, last_synced_at text,
        UNIQUE(user_id, account_id, cycle_start_date, cutoff_date, statement_date)
      );
      INSERT INTO credit_card_cycles
        (id, user_id, account_id, cycle_start_date, cutoff_date, statement_date, version, deleted, created_at, updated_at, last_synced_at)
      SELECT id, user_id, account_id, cycle_start_date, cutoff_date, statement_date, version, deleted, created_at, updated_at, last_synced_at
      FROM credit_card_cycles_old;
      DROP TABLE credit_card_cycles_old;
      CREATE INDEX IF NOT EXISTS idx_cc_cycles_account ON credit_card_cycles(user_id, account_id, cutoff_date);
    `);
  },
};

export default migration;
