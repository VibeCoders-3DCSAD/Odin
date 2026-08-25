import type { Migration } from "../client";

const migration: Migration = {
  version: 17,
  up: async (db) => {
    await db.execAsync(`
      -- Keep the newest live budget for each user before adding the invariant.
      WITH ranked_live_budgets AS (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY updated_at DESC, created_at DESC, id DESC
          ) AS budget_rank
        FROM budgets
        WHERE deleted = 0 AND status != 'deleted'
      )
      UPDATE budgets
      SET status = 'deleted', deleted = 1, version = version + 1, updated_at = datetime('now')
      WHERE id IN (
        SELECT id FROM ranked_live_budgets WHERE budget_rank > 1
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_one_live_per_user
        ON budgets (user_id)
        WHERE deleted = 0 AND status != 'deleted';
    `);
  },
};

export default migration;
