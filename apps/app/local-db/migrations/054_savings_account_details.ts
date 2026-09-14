import type { Migration } from "../client";

const migration: Migration = {
  version: 54,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE savings_account_details (
        account_id text primary key,
        user_id text not null,
        account_type text not null,
        interest_rate_bps integer,
        minimum_balance_centavos integer,
        base_interest_rate_bps integer,
        effective_interest_rate_bps integer,
        interest_conditions text,
        principal_centavos integer,
        maturity_date text,
        term_months integer,
        early_withdrawal_rule text,
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text,
        CHECK (account_type IN ('personal_savings', 'high_yield_savings', 'time_deposit')),
        CHECK (interest_rate_bps IS NULL OR interest_rate_bps >= 0),
        CHECK (minimum_balance_centavos IS NULL OR minimum_balance_centavos >= 0),
        CHECK (base_interest_rate_bps IS NULL OR base_interest_rate_bps >= 0),
        CHECK (effective_interest_rate_bps IS NULL OR effective_interest_rate_bps >= 0),
        CHECK (principal_centavos IS NULL OR principal_centavos > 0)
      );
      CREATE INDEX idx_savings_account_details_user_active
        ON savings_account_details(user_id, deleted, account_type);

      INSERT INTO savings_account_details (
        account_id, user_id, account_type, version, deleted, created_at, updated_at
      )
      SELECT id, user_id, 'personal_savings', 1, 0, created_at, updated_at
      FROM financial_accounts
      WHERE kind = 'savings' AND deleted = 0;
    `);
  },
};

export default migration;
