import type { Migration } from "../client";

const migration: Migration = {
  version: 80,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE categories ADD COLUMN icon_key text NOT NULL DEFAULT 'tag';
      ALTER TABLE categories ADD COLUMN color_hex text NOT NULL DEFAULT '#0F766E';
      ALTER TABLE subcategories ADD COLUMN icon_key text NOT NULL DEFAULT 'tag';
      ALTER TABLE subcategories ADD COLUMN color_hex text NOT NULL DEFAULT '#0F766E';
    `);
  },
};

export default migration;
