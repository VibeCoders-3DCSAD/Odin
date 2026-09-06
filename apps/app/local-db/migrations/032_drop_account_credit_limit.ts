import type { Migration } from "../client";

const migration: Migration = {
  version: 32,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE financial_accounts DROP COLUMN credit_limit_centavos;
      ALTER TABLE credit_card_details ADD COLUMN billing_cycle_days integer CHECK (billing_cycle_days BETWEEN 28 AND 31);
      ALTER TABLE credit_card_details ADD COLUMN alert_threshold_percent integer CHECK (alert_threshold_percent BETWEEN 0 AND 100);
    `);
  },
};

export default migration;