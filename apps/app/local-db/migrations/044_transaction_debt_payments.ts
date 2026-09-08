import type { Migration } from "../client";

const migration: Migration = {
  version: 44,
  up: async (db) => {
    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS debt_payments_live_transaction_idx
        ON debt_payments(user_id, transaction_id) WHERE deleted = 0 AND transaction_id IS NOT NULL;
      CREATE TRIGGER IF NOT EXISTS debt_payment_transaction_guard
      BEFORE INSERT ON debt_payments
      WHEN NEW.deleted = 0 AND (
        NEW.amount_centavos <= 0 OR NEW.source <> 'transaction' OR NEW.transaction_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM debt_accounts d WHERE d.id = NEW.debt_account_id AND d.user_id = NEW.user_id AND d.status = 'active' AND d.deleted = 0)
        OR NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id = NEW.transaction_id AND t.user_id = NEW.user_id AND t.transaction_type = 'expense' AND t.amount_centavos = NEW.amount_centavos AND t.deleted = 0)
      ) BEGIN SELECT RAISE(ABORT, 'Debt payment relationships are invalid'); END;
    `);
  },
};

export default migration;
