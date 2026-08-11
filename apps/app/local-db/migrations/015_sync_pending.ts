import type { Migration } from "../client";

const migration: Migration = {
  version: 15,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE sync_state
      ADD COLUMN pull_pending integer NOT NULL DEFAULT 0;
    `);
  },
};

export default migration;
