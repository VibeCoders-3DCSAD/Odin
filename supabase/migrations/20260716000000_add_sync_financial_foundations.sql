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

-- Sync pull indexes (no partial predicate — pull needs tombstones too)
CREATE INDEX IF NOT EXISTS idx_financial_accounts_updated_at
  ON financial_accounts (updated_at, id);

CREATE INDEX IF NOT EXISTS idx_income_sources_updated_at
  ON income_sources (updated_at, id);

CREATE INDEX IF NOT EXISTS idx_financial_obligations_updated_at
  ON financial_obligations (updated_at, id);

-- Sync bump triggers for financial tables
CREATE TRIGGER financial_accounts_sync_bump
  BEFORE UPDATE ON financial_accounts
  FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();

CREATE TRIGGER income_sources_sync_bump
  BEFORE UPDATE ON income_sources
  FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();

CREATE TRIGGER financial_obligations_sync_bump
  BEFORE UPDATE ON financial_obligations
  FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();
