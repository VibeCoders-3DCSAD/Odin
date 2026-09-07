import type { Migration } from "../client";

const migration: Migration = {
  version: 36,
  up: async (db) => {
    const detailsOld = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'credit_card_details_old'",
    );
    const cyclesOld = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'credit_card_cycles_old'",
    );
    if (detailsOld) await db.execAsync("DROP TABLE IF EXISTS credit_card_details");
    if (cyclesOld) await db.execAsync("DROP TABLE IF EXISTS credit_card_cycles");

    await db.execAsync(`
      DROP TRIGGER IF EXISTS credit_card_purchase_cycle_guard;
      ALTER TABLE credit_card_details RENAME TO credit_card_details_old;
      CREATE TABLE credit_card_details (
        account_id text primary key, user_id text not null, issuer text, credit_limit_centavos integer not null,
        available_credit_centavos integer, cutoff_day integer not null check (cutoff_day between 1 and 31), statement_day integer,
        notes text, billing_cycle_days integer, alert_threshold_percent integer,
        version integer not null default 1, deleted integer not null default 0,
        created_at text not null, updated_at text not null, last_synced_at text
      );
      INSERT INTO credit_card_details
        (account_id, user_id, issuer, credit_limit_centavos, available_credit_centavos, cutoff_day, statement_day,
         notes, billing_cycle_days, alert_threshold_percent, version, deleted, created_at, updated_at, last_synced_at)
      SELECT account_id, user_id, issuer, credit_limit_centavos, available_credit_centavos, cutoff_day, statement_day,
        notes, billing_cycle_days, alert_threshold_percent, version, deleted, created_at, updated_at, last_synced_at
      FROM credit_card_details_old;
      DROP TABLE credit_card_details_old;

      ALTER TABLE credit_card_cycles RENAME TO credit_card_cycles_old;
      CREATE TABLE credit_card_cycles (
        id text primary key, user_id text not null, account_id text not null, cycle_start_date text not null,
        cutoff_date text not null, statement_date text,
        version integer not null default 1, deleted integer not null default 0,
        created_at text not null, updated_at text not null, last_synced_at text,
        UNIQUE(user_id, account_id, cycle_start_date, cutoff_date)
      );
      INSERT INTO credit_card_cycles
        (id, user_id, account_id, cycle_start_date, cutoff_date, statement_date, version, deleted, created_at, updated_at, last_synced_at)
      SELECT id, user_id, account_id, cycle_start_date, cutoff_date, statement_date, version, deleted, created_at, updated_at, last_synced_at
      FROM credit_card_cycles_old;
      DROP TABLE credit_card_cycles_old;
      CREATE INDEX IF NOT EXISTS idx_cc_cycles_account ON credit_card_cycles(user_id, account_id, cutoff_date);
      CREATE TRIGGER credit_card_purchase_cycle_guard
      BEFORE INSERT ON credit_card_transactions
      WHEN NEW.deleted = 0 AND NOT EXISTS (
        SELECT 1 FROM credit_card_cycles c
        JOIN transactions t ON t.id = NEW.transaction_id
        WHERE c.id = NEW.cycle_id AND c.user_id = NEW.user_id AND c.account_id = NEW.account_id
          AND COALESCE(t.credit_card_posting_date, t.transaction_date) BETWEEN c.cycle_start_date AND c.cutoff_date
      )
      BEGIN
        SELECT RAISE(ABORT, 'Credit-card cycle does not match posting date');
      END;
    `);
  },
};

export default migration;
