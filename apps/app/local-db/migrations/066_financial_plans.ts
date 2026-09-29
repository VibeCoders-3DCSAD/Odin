import type { Migration } from "../client";

const migration: Migration = {
  version: 66,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS financial_plans (
        id text primary key,
        user_id text not null,
        period_start text not null,
        period_end text not null,
        status text not null,
        input_snapshot_json text not null,
        recommendation_json text not null,
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
      CREATE INDEX IF NOT EXISTS idx_financial_plans_user_period
        ON financial_plans (user_id, period_start desc, deleted);
    `);
  },
};

export default migration;
