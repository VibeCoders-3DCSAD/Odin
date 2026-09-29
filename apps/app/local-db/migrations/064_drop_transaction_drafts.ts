import type { Migration } from "../client";

const migration: Migration = {
  version: 64,
  up: async (db) => {
    await db.execAsync(`DROP TABLE IF EXISTS transaction_drafts;`);
  },
};

export default migration;
