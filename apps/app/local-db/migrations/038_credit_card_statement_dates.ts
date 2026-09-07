import type { Migration } from "../client";

const migration: Migration = {
  version: 38,
  up: async (db) => {
    await db.execAsync(`
      DROP TRIGGER IF EXISTS credit_card_statement_validate;
      DROP TRIGGER IF EXISTS credit_card_statement_immutable;
      DROP TRIGGER IF EXISTS credit_card_cycle_overlap_insert;
      DROP TRIGGER IF EXISTS credit_card_cycle_overlap_update;
      DROP TRIGGER IF EXISTS credit_card_cycle_recorded_immutable;
      DROP TRIGGER IF EXISTS credit_card_purchase_cycle_guard;

      ALTER TABLE credit_card_statements RENAME TO credit_card_statements_old;
      CREATE TABLE credit_card_statements (
        id text primary key, user_id text not null, cycle_id text not null,
        statement_date text not null, statement_balance_centavos integer not null check (statement_balance_centavos >= 0),
        minimum_due_centavos integer not null check (minimum_due_centavos >= 0 AND minimum_due_centavos <= statement_balance_centavos),
        finance_charge_centavos integer not null default 0 check (finance_charge_centavos >= 0), due_date text not null,
        authoritative integer not null default 1 check (authoritative = 1), version integer not null default 1,
        deleted integer not null default 0, created_at text not null, updated_at text not null, last_synced_at text
      );
      INSERT INTO credit_card_statements
        (id, user_id, cycle_id, statement_date, statement_balance_centavos, minimum_due_centavos,
         finance_charge_centavos, due_date, authoritative, version, deleted, created_at, updated_at, last_synced_at)
      SELECT id, user_id, cycle_id, due_date, statement_balance_centavos, minimum_due_centavos,
             finance_charge_centavos, due_date, authoritative, version, deleted, created_at, updated_at, last_synced_at
        FROM credit_card_statements_old;
      DROP TABLE credit_card_statements_old;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_statements_live_cycle
        ON credit_card_statements(user_id, cycle_id) WHERE deleted = 0;
      UPDATE credit_card_cycles
         SET statement_date = NULL
       WHERE statement_date IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM credit_card_statements s
            WHERE s.user_id = credit_card_cycles.user_id
              AND s.cycle_id = credit_card_cycles.id AND s.deleted = 0
         );

      CREATE TRIGGER credit_card_statement_validate
      BEFORE INSERT ON credit_card_statements
      WHEN NEW.deleted = 0 AND (
        NEW.statement_date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        OR NEW.due_date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        OR NOT EXISTS (
          SELECT 1 FROM credit_card_cycles c
          JOIN financial_accounts a ON a.id = c.account_id AND a.user_id = c.user_id
          WHERE c.id = NEW.cycle_id AND c.user_id = NEW.user_id AND c.deleted = 0
            AND a.kind = 'credit_card' AND a.deleted = 0
            AND c.cutoff_date <= NEW.statement_date AND c.cutoff_date < date('now')
            AND (c.statement_date IS NULL OR c.statement_date = NEW.statement_date)
        )
      ) BEGIN SELECT RAISE(ABORT, 'Credit-card statement is invalid'); END;

      CREATE TRIGGER credit_card_statement_immutable
      BEFORE UPDATE ON credit_card_statements
      WHEN OLD.deleted = 0 AND (
        NEW.statement_date IS NOT OLD.statement_date
        OR NEW.statement_balance_centavos IS NOT OLD.statement_balance_centavos
        OR NEW.minimum_due_centavos IS NOT OLD.minimum_due_centavos
        OR NEW.finance_charge_centavos IS NOT OLD.finance_charge_centavos
        OR NEW.due_date IS NOT OLD.due_date
        OR NEW.authoritative IS NOT OLD.authoritative
        OR NEW.deleted IS NOT OLD.deleted
      ) BEGIN SELECT RAISE(ABORT, 'Recorded credit-card statements are immutable'); END;

      CREATE TRIGGER credit_card_cycle_overlap_insert
      BEFORE INSERT ON credit_card_cycles
      WHEN NEW.deleted = 0 AND EXISTS (
        SELECT 1 FROM credit_card_cycles c
        WHERE c.user_id = NEW.user_id AND c.account_id = NEW.account_id AND c.deleted = 0
          AND NEW.cycle_start_date <= c.cutoff_date AND NEW.cutoff_date >= c.cycle_start_date
      ) BEGIN SELECT RAISE(ABORT, 'Credit-card billing cycles cannot overlap'); END;

      CREATE TRIGGER credit_card_cycle_overlap_update
      BEFORE UPDATE OF cycle_start_date, cutoff_date ON credit_card_cycles
      WHEN NEW.deleted = 0 AND EXISTS (
        SELECT 1 FROM credit_card_cycles c
        WHERE c.user_id = NEW.user_id AND c.account_id = NEW.account_id AND c.deleted = 0 AND c.id != NEW.id
          AND NEW.cycle_start_date <= c.cutoff_date AND NEW.cutoff_date >= c.cycle_start_date
      ) BEGIN SELECT RAISE(ABORT, 'Credit-card billing cycles cannot overlap'); END;

      CREATE TRIGGER credit_card_cycle_recorded_immutable
      BEFORE UPDATE OF cycle_start_date, cutoff_date ON credit_card_cycles
      WHEN OLD.statement_date IS NOT NULL
      BEGIN SELECT RAISE(ABORT, 'Recorded credit-card billing cycles cannot be changed'); END;

      CREATE TRIGGER credit_card_purchase_cycle_guard
      BEFORE INSERT ON credit_card_transactions
      WHEN NEW.deleted = 0 AND NOT EXISTS (
        SELECT 1 FROM credit_card_cycles c JOIN transactions t ON t.id = NEW.transaction_id
        WHERE c.id = NEW.cycle_id AND c.user_id = NEW.user_id AND c.account_id = NEW.account_id
          AND COALESCE(t.credit_card_posting_date, t.transaction_date) BETWEEN c.cycle_start_date AND c.cutoff_date
      ) BEGIN SELECT RAISE(ABORT, 'Credit-card cycle does not match posting date'); END;
    `);
  },
};

export default migration;
