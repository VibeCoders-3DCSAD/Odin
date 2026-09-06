import type { Migration } from "../client";

const migration: Migration = {
  version: 24,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE transactions ADD COLUMN credit_card_posting_date text;
      CREATE TABLE IF NOT EXISTS credit_card_details (
        account_id text primary key, user_id text not null, issuer text, credit_limit_centavos integer not null,
        available_credit_centavos integer, cutoff_day integer not null check (cutoff_day between 1 and 31), statement_day integer not null check (statement_day between 1 and 31),
        notes text, version integer not null default 1, deleted integer not null default 0,
        created_at text not null, updated_at text not null, last_synced_at text
      );
      CREATE TABLE IF NOT EXISTS credit_card_cycles (
        id text primary key, user_id text not null, account_id text not null, cycle_start_date text not null,
        cutoff_date text not null, statement_date text not null, version integer not null default 1,
        deleted integer not null default 0, created_at text not null, updated_at text not null, last_synced_at text,
        UNIQUE(user_id, account_id, cycle_start_date)
      );
      CREATE TABLE IF NOT EXISTS credit_card_installments (
        id text primary key, user_id text not null, account_id text not null, transaction_id text,
        description text not null, original_principal_centavos integer not null, remaining_principal_centavos integer not null,
        term_months integer not null, remaining_months integer not null, monthly_amortization_centavos integer not null,
        interest_rate_bps integer not null default 0, interest_type text not null, settlement_status text not null default 'active',
        version integer not null default 1, deleted integer not null default 0, created_at text not null, updated_at text not null, last_synced_at text
      );
      CREATE TABLE IF NOT EXISTS credit_card_transactions (
        transaction_id text primary key, user_id text not null, account_id text not null, cycle_id text not null,
        purchase_type text not null, installment_id text, version integer not null default 1, deleted integer not null default 0,
        created_at text not null, updated_at text not null, last_synced_at text
      );
      CREATE TABLE IF NOT EXISTS credit_card_statements (
        id text primary key, user_id text not null, cycle_id text not null, statement_balance_centavos integer not null,
        minimum_due_centavos integer not null, finance_charge_centavos integer not null default 0, due_date text not null,
        authoritative integer not null default 1, version integer not null default 1, deleted integer not null default 0,
        created_at text not null, updated_at text not null, last_synced_at text
      );
      CREATE TABLE IF NOT EXISTS credit_card_payments (
        id text primary key, user_id text not null, cycle_id text not null, statement_id text, transaction_id text,
         amount_centavos integer not null, payment_date text not null, source_account_id text, notes text,
        version integer not null default 1, deleted integer not null default 0, created_at text not null, updated_at text not null, last_synced_at text
      );
      CREATE TABLE IF NOT EXISTS credit_card_credit_applications (
        id text primary key, user_id text not null, account_id text not null, payment_id text not null,
        amount_centavos integer not null, applied_date text not null, target_transaction_id text, version integer not null default 1,
        deleted integer not null default 0, created_at text not null, updated_at text not null, last_synced_at text
      );
      CREATE TABLE IF NOT EXISTS credit_card_settlements (
        id text primary key, user_id text not null, installment_id text not null, settlement_date text not null,
        remaining_principal_centavos integer not null, settlement_amount_centavos integer not null,
        pretermination_fee_centavos integer not null default 0, status text not null, version integer not null default 1,
        deleted integer not null default 0, created_at text not null, updated_at text not null, last_synced_at text
      );
      CREATE TABLE IF NOT EXISTS credit_card_statement_strategies (
        statement_id text primary key, user_id text not null, strategy text not null, custom_amount_centavos integer,
        version integer not null default 1, deleted integer not null default 0, created_at text not null, updated_at text not null, last_synced_at text
      );
      CREATE INDEX IF NOT EXISTS idx_cc_cycles_account ON credit_card_cycles(user_id, account_id, cutoff_date);
      CREATE INDEX IF NOT EXISTS idx_cc_tx_cycle ON credit_card_transactions(user_id, account_id, cycle_id);
      CREATE INDEX IF NOT EXISTS idx_cc_statements_cycle ON credit_card_statements(user_id, cycle_id);
    `);
  },
};

export default migration;
