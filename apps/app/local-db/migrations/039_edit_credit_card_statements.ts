import type { Migration } from "../client";

const migration: Migration = {
  version: 39,
  up: async (db) => {
    await db.execAsync(`
      DROP TRIGGER IF EXISTS credit_card_statement_immutable;
      CREATE TRIGGER credit_card_statement_update_validate
      BEFORE UPDATE OF statement_date ON credit_card_statements
      WHEN NEW.deleted = 0 AND NOT EXISTS (
        SELECT 1 FROM credit_card_cycles c
         JOIN financial_accounts a ON a.id = c.account_id AND a.user_id = c.user_id
        WHERE c.id = NEW.cycle_id AND c.user_id = NEW.user_id AND c.deleted = 0
          AND a.kind = 'credit_card' AND a.deleted = 0
          AND c.cutoff_date <= NEW.statement_date
      ) BEGIN SELECT RAISE(ABORT, 'Credit-card statement is invalid'); END;
    `);
  },
};

export default migration;
