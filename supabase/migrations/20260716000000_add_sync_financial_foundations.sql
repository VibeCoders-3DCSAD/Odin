-- Add sync columns to financial tables
ALTER TABLE financial_accounts
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;

ALTER TABLE income_sources
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;

ALTER TABLE financial_obligations
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;

-- Sync pull indexes
CREATE INDEX IF NOT EXISTS idx_financial_accounts_updated_at
  ON financial_accounts (updated_at, id) WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_income_sources_updated_at
  ON income_sources (updated_at, id) WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_financial_obligations_updated_at
  ON financial_obligations (updated_at, id) WHERE deleted = false;
