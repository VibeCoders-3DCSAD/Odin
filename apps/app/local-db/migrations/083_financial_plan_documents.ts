import type { Migration } from "../client";

const migration: Migration = {
  version: 83,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE financial_plans ADD COLUMN input_snapshot_json text;
      ALTER TABLE financial_plans ADD COLUMN recommendation_json text;
    `);
  },
};

export default migration;
