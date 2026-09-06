import type { Migration } from "../client";

const migration: Migration = {
  version: 31,
  up: async (db) => {
    await db.execAsync(`
      DROP TRIGGER IF EXISTS credit_card_purchase_cycle_guard;
      CREATE TRIGGER credit_card_purchase_cycle_guard
      BEFORE INSERT ON credit_card_transactions
      WHEN NEW.deleted = 0 AND NEW.last_synced_at IS NULL AND NOT EXISTS (
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
