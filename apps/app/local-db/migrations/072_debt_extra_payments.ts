import type { Migration } from "../client";

const migration: Migration = {
  version: 72,
  up: async (db) => {
    await db.execAsync("ALTER TABLE debt_accounts ADD COLUMN allows_extra_payments integer NOT NULL DEFAULT 0");
  },
};

export default migration;
