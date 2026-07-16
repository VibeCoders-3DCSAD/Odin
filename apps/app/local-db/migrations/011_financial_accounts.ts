import type { Migration } from "../client";

const migration: Migration = {
  version: 11,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS financial_accounts (
        id text primary key,
        user_id text not null,
        name text not null,
        kind text not null,
        status text not null default 'active',
        opening_balance_centavos integer not null default 0,
        current_balance_centavos integer not null default 0,
        credit_limit_centavos integer,
        include_in_dashboard_balance integer not null default 1,
        institution_name text,
        opened_on text,
        archived_at text,
        sort_order integer not null default 0,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_financial_accounts_user_status
        ON financial_accounts (user_id, status, sort_order);
    `);
  },
};

export default migration;
