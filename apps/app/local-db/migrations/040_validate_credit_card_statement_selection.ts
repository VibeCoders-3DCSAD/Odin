import type { Migration } from "../client";

const migration: Migration = {
  version: 40,
  up: async (db) => {
    await db.execAsync(`
      DROP TRIGGER IF EXISTS credit_card_statement_validate;
      DROP TRIGGER IF EXISTS credit_card_statement_update_validate;
      CREATE TRIGGER credit_card_statement_insert_date_validate
      BEFORE INSERT ON credit_card_statements
      WHEN NEW.deleted = 0 AND (
        NEW.statement_date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        OR NEW.statement_date <= (SELECT cycle_start_date FROM credit_card_cycles WHERE id = NEW.cycle_id AND user_id = NEW.user_id)
        OR NEW.statement_date > date('now')
      ) BEGIN SELECT RAISE(ABORT, 'Credit-card statement date is invalid'); END;
      CREATE TRIGGER credit_card_statement_update_date_validate
      BEFORE UPDATE OF statement_date ON credit_card_statements
      WHEN NEW.deleted = 0 AND (
        NEW.statement_date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        OR NEW.statement_date <= (SELECT cycle_start_date FROM credit_card_cycles WHERE id = NEW.cycle_id AND user_id = NEW.user_id)
        OR NEW.statement_date > date('now')
      ) BEGIN SELECT RAISE(ABORT, 'Credit-card statement date is invalid'); END;
    `);
  },
};

export default migration;
