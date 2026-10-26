import type { Migration } from "../client";

// Whether surplus guidance may suggest paying extra toward this card, like debt_accounts.allows_extra_payments.
const migration: Migration = {
  version: 92,
  up: async (db) => {
    await db.execAsync("ALTER TABLE credit_card_details ADD COLUMN allows_extra_payments integer NOT NULL DEFAULT 0;");
  },
};

export default migration;
