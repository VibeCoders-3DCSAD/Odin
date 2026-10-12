import type { Migration } from "../client";

const migration: Migration = {
  version: 75,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE categories
        ADD COLUMN classification text NOT NULL DEFAULT 'essential'
        CHECK (classification IN ('essential', 'non_essential'));
    `);
  },
};

export default migration;
