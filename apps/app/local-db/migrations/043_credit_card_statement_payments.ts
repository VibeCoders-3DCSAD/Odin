import type { Migration } from "../client";

const migration: Migration = {
  version: 43,
  up: async (db) => {
    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS credit_card_payments_live_cycle_idx
        ON credit_card_payments(user_id, cycle_id) WHERE deleted = 0;
      CREATE UNIQUE INDEX IF NOT EXISTS credit_card_payments_live_transaction_idx
        ON credit_card_payments(user_id, transaction_id) WHERE deleted = 0;
      CREATE INDEX IF NOT EXISTS credit_card_payments_statement_idx
        ON credit_card_payments(user_id, statement_id, deleted);

      CREATE TRIGGER IF NOT EXISTS credit_card_payment_relationship_guard
      BEFORE INSERT ON credit_card_payments
      WHEN NEW.deleted = 0 AND (
        NEW.amount_centavos <= 0
        OR NEW.amount_centavos > COALESCE((SELECT statement_balance_centavos FROM credit_card_statements WHERE id = NEW.statement_id AND user_id = NEW.user_id AND deleted = 0), -1)
        OR NEW.statement_id IS NULL
        OR NEW.transaction_id IS NULL
        OR NEW.source_account_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM credit_card_statements s
          WHERE s.id = NEW.statement_id AND s.cycle_id = NEW.cycle_id
            AND s.user_id = NEW.user_id AND s.authoritative = 1 AND s.deleted = 0
        )
        OR NOT EXISTS (
          SELECT 1 FROM credit_card_cycles c
          WHERE c.id = NEW.cycle_id AND c.user_id = NEW.user_id AND c.deleted = 0
        )
        OR NOT EXISTS (
          SELECT 1 FROM financial_accounts a
          WHERE a.id = NEW.source_account_id AND a.user_id = NEW.user_id
            AND a.kind <> 'credit_card' AND a.status = 'active' AND a.deleted = 0
        )
        OR NOT EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.id = NEW.transaction_id AND t.user_id = NEW.user_id
            AND t.transaction_type = 'expense' AND t.source_account_id = NEW.source_account_id
            AND t.amount_centavos = NEW.amount_centavos AND t.deleted = 0
        )
      ) BEGIN SELECT RAISE(ABORT, 'Credit-card payment relationships are invalid'); END;

      CREATE TRIGGER IF NOT EXISTS credit_card_payment_update_relationship_guard
      BEFORE UPDATE OF amount_centavos, payment_date, source_account_id, notes ON credit_card_payments
      WHEN NEW.deleted = 0 AND (
        NEW.amount_centavos <= 0
        OR NEW.amount_centavos > COALESCE((SELECT statement_balance_centavos FROM credit_card_statements WHERE id = NEW.statement_id AND user_id = NEW.user_id AND deleted = 0), -1)
        OR NEW.statement_id IS NULL
        OR NEW.transaction_id IS NULL
        OR NEW.source_account_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM credit_card_statements s
          WHERE s.id = NEW.statement_id AND s.cycle_id = NEW.cycle_id
            AND s.user_id = NEW.user_id AND s.authoritative = 1 AND s.deleted = 0
        )
        OR NOT EXISTS (
          SELECT 1 FROM financial_accounts a
          WHERE a.id = NEW.source_account_id AND a.user_id = NEW.user_id
            AND a.kind <> 'credit_card' AND a.status = 'active' AND a.deleted = 0
        )
        OR NOT EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.id = NEW.transaction_id AND t.user_id = NEW.user_id
            AND t.transaction_type = 'expense' AND t.source_account_id = NEW.source_account_id
            AND t.amount_centavos = NEW.amount_centavos AND t.deleted = 0
        )
      ) BEGIN SELECT RAISE(ABORT, 'Credit-card payment relationships are invalid'); END;
    `);
  },
};

export default migration;
