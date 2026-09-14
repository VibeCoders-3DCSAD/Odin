import type { Migration } from "../client";

const migration: Migration = {
  version: 53,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE savings_goals ADD COLUMN goal_category text;
      ALTER TABLE savings_goals ADD COLUMN auto_save_amount_centavos integer NOT NULL DEFAULT 0;
      ALTER TABLE savings_goals ADD COLUMN interest_rate_bps integer;
      ALTER TABLE savings_goals ADD COLUMN notes text;
      ALTER TABLE savings_goals ADD COLUMN emergency_fund_target_method text NOT NULL DEFAULT 'fixed_amount';
      ALTER TABLE savings_goals ADD COLUMN essential_expense_coverage_months integer;
      ALTER TABLE savings_goals ADD COLUMN archived_at text;
      UPDATE savings_goals SET goal_category = goal_type WHERE goal_category IS NULL;
      CREATE TABLE savings_goal_activities (
        id text primary key, user_id text not null, savings_goal_id text not null,
        transaction_id text not null, activity_kind text not null,
        amount_centavos integer not null, activity_date text not null, notes text,
        version integer not null default 1, deleted integer not null default 0,
        created_at text not null, updated_at text not null, last_synced_at text,
        CHECK (activity_kind IN ('contribution', 'withdrawal')),
        CHECK (amount_centavos > 0)
      );
      CREATE UNIQUE INDEX savings_goal_activities_live_transaction_idx
        ON savings_goal_activities(user_id, transaction_id) WHERE deleted = 0;
      CREATE INDEX idx_savings_goal_activities_goal_active
        ON savings_goal_activities(user_id, savings_goal_id, deleted, activity_date DESC);
      ALTER TABLE transactions ADD COLUMN source_savings_goal_id text;
      ALTER TABLE transactions ADD COLUMN destination_savings_goal_id text;
    `);
  },
};

export default migration;
