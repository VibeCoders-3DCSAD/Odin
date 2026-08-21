ALTER TABLE budgets ADD COLUMN IF NOT EXISTS debt_budget_amount_centavos bigint NOT NULL DEFAULT 0;
ALTER TABLE debt_accounts
  ADD COLUMN IF NOT EXISTS preset_key text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS payment_frequency text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS next_due_date date,
  ADD COLUMN IF NOT EXISTS maturity_date date,
  ADD COLUMN IF NOT EXISTS target_payoff_date date,
  ADD COLUMN IF NOT EXISTS interest_period text,
  ADD COLUMN IF NOT EXISTS interest_method text,
  ADD COLUMN IF NOT EXISTS preset_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE debt_payments
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE user_debt_priorities
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE debt_strategy_preferences
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
CREATE INDEX IF NOT EXISTS debt_accounts_updated_idx ON debt_accounts (updated_at, id);
CREATE INDEX IF NOT EXISTS debt_payments_updated_idx ON debt_payments (updated_at, id);
CREATE INDEX IF NOT EXISTS user_debt_priorities_updated_idx ON user_debt_priorities (updated_at, id);
