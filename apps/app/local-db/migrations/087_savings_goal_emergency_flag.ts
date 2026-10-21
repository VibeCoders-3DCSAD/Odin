import type { Migration } from "../client";

const migration: Migration = {
  version: 87,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE savings_goals ADD COLUMN is_emergency_fund integer NOT NULL DEFAULT 0;
      UPDATE savings_goals
      SET is_emergency_fund = 1
      WHERE goal_type = 'emergency_fund' AND deleted = 0
        AND id = (
          SELECT candidate.id
          FROM savings_goals candidate
          WHERE candidate.user_id = savings_goals.user_id
            AND candidate.goal_type = 'emergency_fund'
            AND candidate.deleted = 0
          ORDER BY candidate.updated_at DESC, candidate.created_at DESC
          LIMIT 1
        );
      CREATE UNIQUE INDEX savings_goals_one_emergency_fund_idx
        ON savings_goals(user_id)
        WHERE is_emergency_fund = 1 AND deleted = 0;
    `);
  },
};

export default migration;
