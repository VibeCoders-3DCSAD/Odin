import type { Migration } from "../client";

const migration: Migration = {
  version: 86,
  up: async (db) => {
    await db.execAsync(`
      DROP INDEX savings_goal_activities_live_transaction_idx;
      CREATE UNIQUE INDEX savings_goal_activities_live_transaction_idx
        ON savings_goal_activities(user_id, transaction_id, savings_goal_id) WHERE deleted = 0;
    `);
  },
};
export default migration;
