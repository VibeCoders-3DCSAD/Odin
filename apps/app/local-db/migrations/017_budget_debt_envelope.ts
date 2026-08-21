import type { Migration } from "../client";

const migration: Migration = {
  version: 17,
  up: async (db) => {
    await db.execAsync("ALTER TABLE budgets ADD COLUMN debt_budget_amount_minor integer NOT NULL DEFAULT 0;");
  },
};

export default migration;
