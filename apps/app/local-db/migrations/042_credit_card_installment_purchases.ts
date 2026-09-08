import type { Migration } from "../client";

const migration: Migration = {
  version: 42,
  up: async (db) => {
    await db.execAsync(`
      DROP TRIGGER IF EXISTS credit_card_purchase_credit_guard;
      CREATE TRIGGER IF NOT EXISTS credit_card_installment_validate
      BEFORE INSERT ON credit_card_installments
      WHEN NEW.deleted = 0 AND (
        NEW.original_principal_centavos <= 0
        OR NEW.remaining_principal_centavos < 0
        OR NEW.remaining_principal_centavos > NEW.original_principal_centavos
        OR NEW.term_months <= 0
        OR NEW.remaining_months < 0
        OR NEW.remaining_months > NEW.term_months
        OR NEW.monthly_amortization_centavos <= 0
        OR NEW.interest_rate_bps < 0
        OR NEW.interest_type NOT IN ('zero_interest', 'interest_bearing')
        OR NEW.settlement_status NOT IN ('active', 'early_settlement_requested', 'completed')
      ) BEGIN SELECT RAISE(ABORT, 'Credit-card installment is invalid'); END;
      CREATE INDEX IF NOT EXISTS idx_cc_installments_account ON credit_card_installments(user_id, account_id, deleted);
    `);
  },
};

export default migration;
