import type { Migration } from "../client";

const migration: Migration = {
  version: 26,
  up: async (db) => {
    // Card credit is changed by the local purchase command, not by pull.
    await db.execAsync("DROP TRIGGER IF EXISTS credit_card_purchase_credit_guard;");
  },
};

export default migration;
