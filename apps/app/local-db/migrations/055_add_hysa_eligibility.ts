import type { Migration } from "../client";

const migration: Migration = {
  version: 55,
  up: async (db) => {
    await db.execAsync("ALTER TABLE savings_account_details ADD COLUMN higher_rate_eligible integer;");
  },
};

export default migration;
