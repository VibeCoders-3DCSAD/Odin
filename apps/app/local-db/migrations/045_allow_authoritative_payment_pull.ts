import type { Migration } from "../client";

const migration: Migration = {
  version: 45,
  up: async (db) => {
    await db.execAsync(`
      DROP TRIGGER IF EXISTS credit_card_cycle_overlap_insert;
      DROP TRIGGER IF EXISTS credit_card_cycle_overlap_update;
      DROP TRIGGER IF EXISTS credit_card_purchase_cycle_guard;
      DROP TRIGGER IF EXISTS credit_card_statement_insert_date_validate;
      DROP TRIGGER IF EXISTS credit_card_payment_relationship_guard;
      DROP TRIGGER IF EXISTS debt_payment_transaction_guard;
      CREATE TRIGGER credit_card_cycle_overlap_insert BEFORE INSERT ON credit_card_cycles
      WHEN NEW.deleted = 0 AND NEW.last_synced_at IS NULL AND EXISTS (SELECT 1 FROM credit_card_cycles c WHERE c.user_id = NEW.user_id AND c.account_id = NEW.account_id AND c.deleted = 0 AND NEW.cycle_start_date <= c.cutoff_date AND NEW.cutoff_date >= c.cycle_start_date)
      BEGIN SELECT RAISE(ABORT, 'Credit-card billing cycles cannot overlap'); END;
      CREATE TRIGGER credit_card_cycle_overlap_update BEFORE UPDATE OF cycle_start_date, cutoff_date ON credit_card_cycles
      WHEN NEW.deleted = 0 AND NEW.last_synced_at IS NULL AND EXISTS (SELECT 1 FROM credit_card_cycles c WHERE c.user_id = NEW.user_id AND c.account_id = NEW.account_id AND c.deleted = 0 AND c.id != NEW.id AND NEW.cycle_start_date <= c.cutoff_date AND NEW.cutoff_date >= c.cycle_start_date)
      BEGIN SELECT RAISE(ABORT, 'Credit-card billing cycles cannot overlap'); END;
      CREATE TRIGGER credit_card_purchase_cycle_guard BEFORE INSERT ON credit_card_transactions
      WHEN NEW.deleted = 0 AND NEW.last_synced_at IS NULL AND NOT EXISTS (SELECT 1 FROM credit_card_cycles c JOIN transactions t ON t.id = NEW.transaction_id WHERE c.id = NEW.cycle_id AND c.user_id = NEW.user_id AND c.account_id = NEW.account_id AND COALESCE(t.credit_card_posting_date, t.transaction_date) BETWEEN c.cycle_start_date AND c.cutoff_date)
      BEGIN SELECT RAISE(ABORT, 'Credit-card cycle does not match posting date'); END;
      CREATE TRIGGER credit_card_statement_insert_date_validate BEFORE INSERT ON credit_card_statements
      WHEN NEW.deleted = 0 AND NEW.last_synced_at IS NULL AND (NEW.statement_date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR NEW.statement_date < (SELECT cutoff_date FROM credit_card_cycles WHERE id = NEW.cycle_id AND user_id = NEW.user_id) OR NEW.statement_date > date('now'))
      BEGIN SELECT RAISE(ABORT, 'Credit-card statement date is invalid'); END;
      CREATE TRIGGER credit_card_payment_relationship_guard BEFORE INSERT ON credit_card_payments
      WHEN NEW.deleted = 0 AND NEW.last_synced_at IS NULL AND (NEW.amount_centavos <= 0 OR NEW.amount_centavos > COALESCE((SELECT statement_balance_centavos FROM credit_card_statements WHERE id = NEW.statement_id AND user_id = NEW.user_id AND deleted = 0), -1) OR NEW.statement_id IS NULL OR NEW.transaction_id IS NULL OR NEW.source_account_id IS NULL OR NOT EXISTS (SELECT 1 FROM credit_card_statements s WHERE s.id = NEW.statement_id AND s.cycle_id = NEW.cycle_id AND s.user_id = NEW.user_id AND s.authoritative = 1 AND s.deleted = 0) OR NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id = NEW.transaction_id AND t.user_id = NEW.user_id AND t.transaction_type = 'expense' AND t.source_account_id = NEW.source_account_id AND t.amount_centavos = NEW.amount_centavos AND t.deleted = 0))
      BEGIN SELECT RAISE(ABORT, 'Credit-card payment relationships are invalid'); END;
      CREATE TRIGGER debt_payment_transaction_guard BEFORE INSERT ON debt_payments
      WHEN NEW.deleted = 0 AND NEW.last_synced_at IS NULL AND (NEW.amount_centavos <= 0 OR NEW.source <> 'transaction' OR NEW.transaction_id IS NULL OR NOT EXISTS (SELECT 1 FROM debt_accounts d WHERE d.id = NEW.debt_account_id AND d.user_id = NEW.user_id AND d.status = 'active' AND d.deleted = 0) OR NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id = NEW.transaction_id AND t.user_id = NEW.user_id AND t.transaction_type = 'expense' AND t.amount_centavos = NEW.amount_centavos AND t.deleted = 0))
      BEGIN SELECT RAISE(ABORT, 'Debt payment relationships are invalid'); END;
    `);
  },
};
export default migration;
