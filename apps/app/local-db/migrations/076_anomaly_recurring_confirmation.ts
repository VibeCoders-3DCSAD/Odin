import type { Migration } from "../client";

const migration: Migration = {
  version: 76,
  up: async (db) => {
    await db.execAsync("ALTER TABLE anomaly_evaluations ADD COLUMN confirmed_recurring_at text");
  },
};

export default migration;
