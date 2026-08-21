import type { Migration } from "../client";

const migration: Migration = {
  version: 17,
  up: async (db) => {
    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_one_live_per_user
        ON budgets (user_id)
        WHERE deleted = 0 AND status != 'deleted';
    `);
  },
};

export default migration;
