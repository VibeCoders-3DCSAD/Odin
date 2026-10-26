import type { Migration } from "../client";

// The calendar months a yearly unusual-spending answer comes back in, as a JSON array such as [6, 11].
// Null keeps the payment's own month.
const migration: Migration = {
  version: 91,
  up: async (db) => {
    await db.execAsync("ALTER TABLE anomaly_evaluations ADD COLUMN recurrence_months text;");
  },
};

export default migration;
