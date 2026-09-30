import type { Migration } from "../client";

const migration: Migration = {
  version: 68,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE financial_plans ADD COLUMN debt_surplus_centavos integer NOT NULL DEFAULT 0;
      ALTER TABLE financial_plans ADD COLUMN savings_surplus_centavos integer NOT NULL DEFAULT 0;
    `);
  },
};

export default migration;
