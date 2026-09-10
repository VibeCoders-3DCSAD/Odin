import type { Migration } from "../client";

const migration: Migration = {
  version: 48,
  up: async (db) => {
    await db.execAsync("ALTER TABLE credit_card_statement_strategies ADD COLUMN percentage_bps integer;");
  },
};

export default migration;
