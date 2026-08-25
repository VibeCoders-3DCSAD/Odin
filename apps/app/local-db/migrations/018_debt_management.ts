import type { Migration } from "../client";

const migration: Migration = {
  version: 18,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS debt_accounts (
        id text primary key, user_id text not null, linked_account_id text,
        name text not null, lender_name text, preset_key text not null default 'unknown',
        status text not null default 'active', original_balance_centavos integer not null default 0,
        current_balance_centavos integer not null, annual_interest_rate_bps integer not null default 0,
        minimum_payment_centavos integer not null default 0, payment_frequency text not null default 'monthly',
        next_due_date text, maturity_date text, target_payoff_date text, interest_period text,
        interest_method text, preset_data text not null default '{}', notes text,
        version integer not null default 1, deleted integer not null default 0,
        created_at text not null, updated_at text not null, last_synced_at text
      );
      CREATE INDEX IF NOT EXISTS idx_debt_accounts_user_status ON debt_accounts(user_id, status, deleted);
      CREATE TABLE IF NOT EXISTS debt_payments (
        id text primary key, debt_account_id text not null, user_id text not null,
        transaction_id text, source text not null default 'manual', payment_date text not null,
        amount_centavos integer not null, principal_centavos integer, interest_centavos integer,
        notes text, version integer not null default 1, deleted integer not null default 0,
        created_at text not null, updated_at text not null, last_synced_at text
      );
      CREATE INDEX IF NOT EXISTS idx_debt_payments_user_debt ON debt_payments(user_id, debt_account_id, payment_date desc);
      CREATE TABLE IF NOT EXISTS user_debt_priorities (
        id text primary key, user_id text not null, debt_account_id text not null,
        priority_rank integer not null, version integer not null default 1,
        deleted integer not null default 0, created_at text not null, updated_at text not null,
        last_synced_at text, UNIQUE(user_id, debt_account_id), UNIQUE(user_id, priority_rank)
      );
      CREATE TABLE IF NOT EXISTS debt_strategy_preferences (
        user_id text primary key, strategy text not null default 'avalanche',
        version integer not null default 1, deleted integer not null default 0,
        created_at text not null, updated_at text not null, last_synced_at text
      );
    `);
  },
};

export default migration;
