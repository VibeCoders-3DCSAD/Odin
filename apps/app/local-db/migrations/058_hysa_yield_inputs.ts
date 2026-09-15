import type { Migration } from "../client";

const migration: Migration = {
  version: 58,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE savings_account_details ADD COLUMN boosted_interest_rate_bps integer;
      ALTER TABLE savings_account_details ADD COLUMN interest_calculation_basis text;
      ALTER TABLE savings_account_details ADD COLUMN interest_credit_frequency text;
      ALTER TABLE savings_account_details ADD COLUMN maximum_eligible_balance_centavos integer;
      ALTER TABLE savings_account_details ADD COLUMN balance_tiers_json text;
      ALTER TABLE savings_account_details ADD COLUMN required_deposit_centavos integer;
      ALTER TABLE savings_account_details ADD COLUMN required_deposit_frequency text;
      ALTER TABLE savings_account_details ADD COLUMN required_transaction_count integer;
      ALTER TABLE savings_account_details ADD COLUMN required_transaction_period text;
      ALTER TABLE savings_account_details ADD COLUMN direct_deposit_threshold_centavos integer;
      ALTER TABLE savings_account_details ADD COLUMN qualification_period text;
      ALTER TABLE savings_account_details ADD COLUMN promotional_interest_rate_bps integer;
      ALTER TABLE savings_account_details ADD COLUMN promotion_start_date text;
      ALTER TABLE savings_account_details ADD COLUMN promotion_end_date text;
    `);
  },
};

export default migration;
