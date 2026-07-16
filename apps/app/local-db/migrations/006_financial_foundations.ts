import type { SQLiteDatabase } from "expo-sqlite";

const migration: { version: number; up: (db: SQLiteDatabase) => Promise<void> } = {
  version: 6,
  up: async (db: SQLiteDatabase) => {
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
        deleted_at text,
        sort_order integer not null default 0,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );

      CREATE INDEX IF NOT EXISTS idx_financial_accounts_user
        ON financial_accounts (user_id, deleted, status, sort_order);

      CREATE TABLE IF NOT EXISTS income_sources (
        id text primary key,
        user_id text not null,
        name text not null,
        income_type text not null,
        frequency text not null,
        expected_amount_centavos integer,
        min_amount_centavos integer,
        max_amount_centavos integer,
        payday_day_of_month integer,
        payday_second_day_of_month integer,
        payday_day_of_week integer,
        next_expected_date text,
        is_active integer not null default 1,
        notes text,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );

      CREATE INDEX IF NOT EXISTS idx_income_sources_user
        ON income_sources (user_id, deleted, is_active);

      CREATE TABLE IF NOT EXISTS financial_obligations (
        id text primary key,
        user_id text not null,
        subcategory_id text not null,
        recurring_template_id text,
        name text not null,
        status text not null default 'active',
        amount_centavos integer not null,
        frequency text not null,
        due_day_of_month integer,
        is_family_support integer not null default 0,
        is_dependent_support integer not null default 0,
        protected_by_default integer not null default 1,
        starts_on text,
        ends_on text,
        notes text,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );

      CREATE INDEX IF NOT EXISTS idx_financial_obligations_user
        ON financial_obligations (user_id, deleted, status);
    `);
  },
};

export default migration;
