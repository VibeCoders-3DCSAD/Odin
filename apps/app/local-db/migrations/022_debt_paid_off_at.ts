import type { Migration } from "../client";

const migration: Migration = {
  version: 22,
  up: async (db) => {
    await db.execAsync("ALTER TABLE debt_accounts ADD COLUMN paid_off_at text");
  },
};

export default migration;
