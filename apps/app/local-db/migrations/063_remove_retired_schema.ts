import type { Migration } from "../client";

const migration: Migration = {
  version: 63,
  up: async (db) => {
    await db.execAsync(`
      DROP TABLE IF EXISTS transaction_line_items;
      DROP TABLE IF EXISTS transaction_templates;
      DROP TABLE IF EXISTS financial_profile_cache;
    `);
  },
};

export default migration;
