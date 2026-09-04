import type { Migration } from "../client";

const migration: Migration = {
  version: 25,
  up: async (db) => {
    await db.execAsync(`
      CREATE TRIGGER IF NOT EXISTS credit_card_purchase_credit_guard
      AFTER INSERT ON credit_card_transactions
      WHEN NEW.deleted = 0
      BEGIN
        UPDATE credit_card_details
        SET available_credit_centavos = COALESCE(available_credit_centavos, credit_limit_centavos)
          - (SELECT amount_centavos FROM transactions WHERE id = NEW.transaction_id),
          version = version + 1,
          updated_at = datetime('now')
        WHERE account_id = NEW.account_id AND user_id = NEW.user_id AND deleted = 0
          AND COALESCE(available_credit_centavos, credit_limit_centavos)
            >= (SELECT amount_centavos FROM transactions WHERE id = NEW.transaction_id);
        SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'Purchase exceeds available credit') END;
      END;
      CREATE TRIGGER IF NOT EXISTS credit_card_purchase_cycle_guard
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
