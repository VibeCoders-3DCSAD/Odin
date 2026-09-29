import type { Migration } from "../client";

const migration: Migration = {
  version: 65,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE subcategories ADD COLUMN always_in_budget integer NOT NULL DEFAULT 0;
      ALTER TABLE subcategories ADD COLUMN fixed_amount_centavos integer;
    `);
  },
};

export default migration;
