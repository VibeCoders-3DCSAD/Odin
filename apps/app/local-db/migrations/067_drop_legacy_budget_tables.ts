import type { Migration } from "../client";

const migration: Migration = {
  version: 67,
  up: async (db) => {
    await db.execAsync(`
      UPDATE sync_queue
         SET status = 'discarded',
             discarded_at = CURRENT_TIMESTAMP,
             last_error = 'Discarded because legacy budget sync was removed.'
       WHERE entity IN ('budgets', 'budget_allocations')
         AND status IN ('pending', 'failed');
      DROP TABLE IF EXISTS budget_allocations;
      DROP TABLE IF EXISTS budgets;
    `);
  },
};

export default migration;
