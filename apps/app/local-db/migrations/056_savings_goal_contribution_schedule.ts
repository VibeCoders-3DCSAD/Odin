import type { Migration } from "../client";

const migration: Migration = {
  version: 56,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE savings_goals ADD COLUMN planned_contribution_amount_centavos integer;
      ALTER TABLE savings_goals ADD COLUMN contribution_frequency text;
      ALTER TABLE savings_goals ADD COLUMN contribution_interval_count integer;
      ALTER TABLE savings_goals ADD COLUMN contribution_day_of_month integer;
      ALTER TABLE savings_goals ADD COLUMN contribution_second_day_of_month integer;
      ALTER TABLE savings_goals ADD COLUMN contribution_day_of_week integer;
      ALTER TABLE savings_goals ADD COLUMN custom_interval_days integer;
      ALTER TABLE savings_goals ADD COLUMN next_contribution_date text;
      UPDATE savings_goals
      SET planned_contribution_amount_centavos = auto_save_amount_centavos
      WHERE planned_contribution_amount_centavos IS NULL;
    `);
  },
};

export default migration;
