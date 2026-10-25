import type { Migration } from "../client";

// A payment can settle its biller occurrence in full even when it is less than the scheduled amount.
const migration: Migration = {
  version: 88,
  up: async (db) => {
    await db.execAsync("ALTER TABLE scheduled_payment_records ADD COLUMN settles_occurrence integer NOT NULL DEFAULT 0;");
  },
};

export default migration;
