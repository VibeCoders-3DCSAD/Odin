import type { Migration } from "../client";

const migration: Migration = {
  version: 85,
  up: async (db) => {
    await db.execAsync("ALTER TABLE savings_account_details ADD COLUMN interest_reference_json TEXT;");
  },
};
export default migration;
