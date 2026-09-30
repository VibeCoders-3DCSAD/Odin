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
        forecast_month text not null,
        forecast_total_centavos integer not null,
        forecast_model_version text not null,
        forecast_generated_at text not null,
        forecast_quality text not null,
        classification_status text,
        classification_rule_set_version text,
        classification_assessed_at text,
        available_funds_centavos integer not null,
        required_funds_centavos integer,
        shortfall_centavos integer,
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
      CREATE INDEX IF NOT EXISTS idx_financial_plans_user_period
        ON financial_plans (user_id, period_start desc, deleted);
      CREATE TABLE IF NOT EXISTS financial_plan_forecast_points (
        plan_id text not null references financial_plans(id),
        category_key text not null,
        amount_centavos integer not null,
        primary key (plan_id, category_key)
      );
      CREATE TABLE IF NOT EXISTS financial_plan_allocations (
        id text primary key,
        plan_id text not null references financial_plans(id),
        category_id text,
        subcategory_id text,
        allocation_rule text not null,
        allocated_amount_centavos integer not null,
        floor_amount_centavos integer not null,
        ceiling_amount_centavos integer,
        forecast_amount_centavos integer,
        subcategory_weight_bps integer,
        CHECK ((category_id IS NULL) <> (subcategory_id IS NULL))
      );
      CREATE TABLE IF NOT EXISTS financial_plan_debt_reservations (
        id text primary key,
        plan_id text not null references financial_plans(id),
        debt_account_id text,
        credit_card_statement_id text,
        amount_centavos integer not null,
        due_date text,
        CHECK ((debt_account_id IS NULL) <> (credit_card_statement_id IS NULL))
      );
      CREATE TABLE IF NOT EXISTS financial_plan_savings_reservations (
        id text primary key,
        plan_id text not null references financial_plans(id),
        savings_goal_id text not null,
        amount_centavos integer not null,
        due_date text
      );
    `);
  },
};

export default migration;
