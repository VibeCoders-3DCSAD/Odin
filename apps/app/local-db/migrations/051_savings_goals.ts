import type { Migration } from "../client";

const migration: Migration = {
  version: 51,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS savings_goals (
        id text primary key,
        user_id text not null,
        name text not null,
        goal_type text not null,
        target_amount_centavos integer not null,
        starting_amount_centavos integer not null default 0,
        target_date text,
        priority text not null default 'medium',
        emergency_fund_baseline_centavos integer,
        status text not null default 'active',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
      CREATE INDEX IF NOT EXISTS idx_savings_goals_user_active
        ON savings_goals(user_id, deleted, status, updated_at desc);
    `);
  },
};

export default migration;
