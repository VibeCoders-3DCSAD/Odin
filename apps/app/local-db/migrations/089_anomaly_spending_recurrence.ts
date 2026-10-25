import type { Migration } from "../client";

// The unusual-spending answer: one time only, frequent, or yearly. Earlier confirmations meant frequent.
const migration: Migration = {
  version: 89,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE anomaly_evaluations ADD COLUMN recurrence text CHECK (recurrence IN ('one_time', 'frequent', 'yearly'));
      UPDATE anomaly_evaluations SET recurrence = 'frequent' WHERE confirmed_recurring_at IS NOT NULL;
    `);
  },
};

export default migration;
