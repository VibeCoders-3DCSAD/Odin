import type { Migration } from "../client";

const migration: Migration = {
  version: 20,
  up: async (db) => {
    await db.execAsync("ALTER TABLE debt_accounts ADD COLUMN payment_schedule text NOT NULL DEFAULT '{}'");
  },
};

export default migration;
