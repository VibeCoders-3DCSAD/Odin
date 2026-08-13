import type { Migration } from "../client";

const migration: Migration = {
  version: 16,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS budgets (
        id text primary key,
        user_id text not null,
        status text not null default 'draft',
        allocation_method text not null default 'MANUAL',
        period_kind text not null,
        period_start text not null,
        period_end text not null,
        budget_period_days integer not null,
        total_amount_minor integer not null,
        surplus_handling text not null default 'LEAVE_UNALLOCATED',
        deficit_handling text not null default 'BLOCK_ACTIVATION',
        allow_deficit_planning integer not null default 0,
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );

      CREATE INDEX IF NOT EXISTS idx_budgets_user_status_period
        ON budgets (user_id, status, period_start, period_end);

      CREATE TABLE IF NOT EXISTS budget_allocations (
        id text primary key,
        user_id text not null,
        budget_id text not null references budgets(id) on delete cascade,
        category_id text,
        subcategory_id text,
        allocated_amount_minor integer not null,
        restriction_level text not null default 'OPEN',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null
      );

      CREATE INDEX IF NOT EXISTS idx_budget_allocations_budget
        ON budget_allocations (user_id, budget_id, deleted);
    `);
  },
};

export default migration;
