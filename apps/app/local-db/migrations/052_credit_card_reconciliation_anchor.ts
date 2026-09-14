import type { Migration } from "../client";

const migration: Migration = {
  version: 52,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE credit_card_details ADD COLUMN reconciled_available_credit_centavos integer;
      ALTER TABLE credit_card_details ADD COLUMN pre_reconciliation_available_credit_centavos integer;
      ALTER TABLE credit_card_details ADD COLUMN available_credit_reconciled_at text;
      ALTER TABLE credit_card_transactions ADD COLUMN forecast_recorded_at text;
      ALTER TABLE credit_card_payments ADD COLUMN forecast_recorded_at text;
      UPDATE credit_card_transactions SET forecast_recorded_at = created_at WHERE forecast_recorded_at IS NULL;
      UPDATE credit_card_payments SET forecast_recorded_at = created_at WHERE forecast_recorded_at IS NULL;
    `);
  },
};

export default migration;
