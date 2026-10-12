-- Local database ERD source. Do not run against the application database.
-- This models the D1-D14 data stores in the Budgie DFD as local SQLite tables.
-- All user-owned records retain user_id for device-level account isolation.

-- D1 User Accounts and Settings
CREATE TABLE sync_state (
  user_id text PRIMARY KEY,
  device_id text NOT NULL
);
CREATE TABLE privacy_settings (
  id text PRIMARY KEY,
  user_id text NOT NULL
);

-- D2 Income Sources and Accounts
CREATE TABLE financial_accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  current_balance_centavos integer NOT NULL
);
CREATE TABLE income_sources (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  destination_account_id text REFERENCES financial_accounts(id)
);

-- D3 Income Transactions and D5 Expense Transactions.
-- transaction_type distinguishes income from expense records.
CREATE TABLE transactions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  subcategory_id text REFERENCES subcategories(id),
  source_account_id text REFERENCES financial_accounts(id),
  destination_account_id text REFERENCES financial_accounts(id),
  transaction_type text NOT NULL,
  amount_centavos integer NOT NULL
);

-- D4 Income and Expense Categories
CREATE TABLE categories (
  id text PRIMARY KEY,
  user_id text,
  slug text NOT NULL,
  label text NOT NULL
);
CREATE TABLE subcategories (
  id text PRIMARY KEY,
  category_id text REFERENCES categories(id),
  user_id text,
  slug text NOT NULL,
  kind text NOT NULL
);

-- D6 Bills and Remittances
CREATE TABLE financial_obligations (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  subcategory_id text NOT NULL REFERENCES subcategories(id),
  amount_centavos integer NOT NULL
);

-- D7 Savings Goals and D8 Savings Contributions and Preferences
CREATE TABLE savings_goals (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  name text NOT NULL,
  target_amount_centavos integer NOT NULL
);
CREATE TABLE savings_goal_activities (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  savings_goal_id text NOT NULL REFERENCES savings_goals(id),
  transaction_id text NOT NULL REFERENCES transactions(id),
  amount_centavos integer NOT NULL
);
CREATE TABLE savings_allocation_preferences (
  user_id text PRIMARY KEY,
  strategy text NOT NULL
);

-- D9 Debt Accounts and D10 Debt Payments and Repayment Preferences
CREATE TABLE debt_accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  linked_account_id text REFERENCES financial_accounts(id),
  current_balance_centavos integer NOT NULL
);
CREATE TABLE debt_payments (
  id text PRIMARY KEY,
  debt_account_id text NOT NULL REFERENCES debt_accounts(id),
  user_id text NOT NULL,
  transaction_id text REFERENCES transactions(id),
  amount_centavos integer NOT NULL
);
CREATE TABLE debt_strategy_preferences (
  user_id text PRIMARY KEY,
  strategy text NOT NULL
);

-- D11 Financial Plans
CREATE TABLE financial_plans (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  period_start text NOT NULL,
  period_end text NOT NULL,
  available_funds_centavos integer NOT NULL
);
CREATE TABLE financial_plan_allocations (
  id text PRIMARY KEY,
  plan_id text NOT NULL REFERENCES financial_plans(id),
  category_id text REFERENCES categories(id),
  subcategory_id text REFERENCES subcategories(id),
  allocated_amount_centavos integer NOT NULL
);
CREATE TABLE financial_plan_debt_reservations (
  id text PRIMARY KEY,
  plan_id text NOT NULL REFERENCES financial_plans(id),
  debt_account_id text REFERENCES debt_accounts(id),
  amount_centavos integer NOT NULL
);
CREATE TABLE financial_plan_savings_reservations (
  id text PRIMARY KEY,
  plan_id text NOT NULL REFERENCES financial_plans(id),
  savings_goal_id text NOT NULL REFERENCES savings_goals(id),
  amount_centavos integer NOT NULL
);
CREATE TABLE financial_plan_forecast_points (
  plan_id text NOT NULL REFERENCES financial_plans(id),
  category_key text NOT NULL,
  amount_centavos integer NOT NULL,
  PRIMARY KEY (plan_id, category_key)
);

-- D12 Savings and Debt Profile Classifications
CREATE TABLE financial_condition_assessments (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  assessed_at text NOT NULL,
  rule_set_version text NOT NULL,
  input_snapshot text NOT NULL,
  output_snapshot text NOT NULL
);

-- D13 Unusual Expense Alerts
CREATE TABLE anomaly_evaluations (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  transaction_id text NOT NULL REFERENCES transactions(id),
  subcategory_id text NOT NULL REFERENCES subcategories(id)
);
CREATE TABLE alert_cache (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  category text NOT NULL,
  status text NOT NULL
);

-- D14 Forecast History
CREATE TABLE forecast_runs (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  status text NOT NULL,
  model_version text NOT NULL,
  input_snapshot text NOT NULL,
  generated_at text NOT NULL
);
CREATE TABLE forecast_series (
  id text PRIMARY KEY,
  forecast_run_id text NOT NULL REFERENCES forecast_runs(id),
  series_key text NOT NULL
);
CREATE TABLE forecast_points (
  id text PRIMARY KEY,
  forecast_series_id text NOT NULL REFERENCES forecast_series(id),
  point_at text NOT NULL,
  amount_centavos integer NOT NULL
);
CREATE TABLE forecast_explanation_drivers (
  id text PRIMARY KEY,
  forecast_run_id text NOT NULL REFERENCES forecast_runs(id),
  driver_key text NOT NULL,
  explanation text NOT NULL
);
