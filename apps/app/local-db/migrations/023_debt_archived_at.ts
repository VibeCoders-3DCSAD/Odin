import type { Migration } from "../client";

const migration: Migration = {
  version: 23,
  up: async (db) => {
    await db.execAsync("ALTER TABLE debt_accounts ADD COLUMN archived_at text");
  },
};

export default migration;
