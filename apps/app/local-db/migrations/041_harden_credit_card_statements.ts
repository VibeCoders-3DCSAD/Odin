import type { Migration } from "../client";

const migration: Migration = {
  version: 41,
  up: async (db) => {
    await db.execAsync(`
      DROP TRIGGER IF EXISTS credit_card_statement_insert_date_validate;
      DROP TRIGGER IF EXISTS credit_card_statement_update_date_validate;
      DROP TRIGGER IF EXISTS credit_card_statement_update_validate;
      CREATE TRIGGER credit_card_statement_insert_date_validate
      BEFORE INSERT ON credit_card_statements
      WHEN NEW.deleted = 0 AND (
        NEW.statement_date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        OR NEW.statement_date < (SELECT cutoff_date FROM credit_card_cycles WHERE id = NEW.cycle_id AND user_id = NEW.user_id)
        OR NEW.statement_date > date('now')
      ) BEGIN SELECT RAISE(ABORT, 'Credit-card statement date is invalid'); END;
      CREATE TRIGGER credit_card_statement_immutable
      BEFORE UPDATE ON credit_card_statements
      WHEN OLD.deleted = 0 AND (
        NEW.statement_date IS NOT OLD.statement_date
        OR NEW.statement_balance_centavos IS NOT OLD.statement_balance_centavos
        OR NEW.minimum_due_centavos IS NOT OLD.minimum_due_centavos
        OR NEW.finance_charge_centavos IS NOT OLD.finance_charge_centavos
        OR NEW.due_date IS NOT OLD.due_date
        OR NEW.authoritative IS NOT OLD.authoritative
      ) BEGIN SELECT RAISE(ABORT, 'Recorded credit-card statements are immutable'); END;
    `);
  },
};

export default migration;
