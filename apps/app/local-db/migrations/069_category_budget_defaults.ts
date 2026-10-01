import type { Migration } from "../client";

const migration: Migration = {
  version: 69,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE categories ADD COLUMN minimum_amount_centavos integer;
      ALTER TABLE categories ADD COLUMN always_in_budget integer NOT NULL DEFAULT 0;
      ALTER TABLE categories ADD COLUMN fixed_amount_centavos integer;
      ALTER TABLE transactions ADD COLUMN category_id text;
    `);
  },
};

export default migration;
