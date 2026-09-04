import type { Migration } from "../client";

const migration: Migration = {
  version: 27,
  up: async (db) => {
    await db.execAsync("ALTER TABLE credit_card_payments ADD COLUMN issuer_recognized integer NOT NULL DEFAULT 0;");
  },
};

export default migration;
