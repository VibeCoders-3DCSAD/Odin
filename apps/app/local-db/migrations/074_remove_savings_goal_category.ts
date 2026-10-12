import type { Migration } from "../client";

const migration: Migration = {
  version: 74,
  up: async (db) => {
    await db.execAsync("ALTER TABLE savings_goals DROP COLUMN goal_category;");
  },
};

export default migration;
