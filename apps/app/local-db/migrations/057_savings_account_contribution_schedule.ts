import type { Migration } from "../client";

const migration: Migration = {
  version: 57,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE savings_account_details ADD COLUMN planned_contribution_amount_centavos integer;
      ALTER TABLE savings_account_details ADD COLUMN contribution_frequency text;
      ALTER TABLE savings_account_details ADD COLUMN contribution_interval_count integer;
      ALTER TABLE savings_account_details ADD COLUMN contribution_day_of_month integer;
      ALTER TABLE savings_account_details ADD COLUMN contribution_second_day_of_month integer;
      ALTER TABLE savings_account_details ADD COLUMN contribution_day_of_week integer;
      ALTER TABLE savings_account_details ADD COLUMN custom_interval_days integer;
      ALTER TABLE savings_account_details ADD COLUMN next_contribution_date text;
    `);
  },
};

export default migration;
