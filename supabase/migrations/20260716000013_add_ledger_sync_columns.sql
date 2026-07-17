-- Add sync columns to ledger tables

ALTER TABLE financial_accounts
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
UPDATE financial_accounts SET deleted = true WHERE status = 'deleted' AND deleted = false;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
UPDATE transactions SET deleted = true WHERE status = 'deleted' AND deleted = false;

ALTER TABLE transaction_line_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;

ALTER TABLE transaction_templates
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
UPDATE transaction_templates SET deleted = true WHERE status = 'deleted' AND deleted = false;

ALTER TABLE transaction_drafts
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
UPDATE transaction_drafts SET deleted = true WHERE status = 'discarded' AND deleted = false;

ALTER TABLE recurring_transaction_templates
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
UPDATE recurring_transaction_templates SET deleted = true WHERE status = 'deleted' AND deleted = false;

ALTER TABLE recurring_transaction_occurrences
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;

-- Sync triggers on ledger tables
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'financial_accounts_sync_bump') THEN
  CREATE TRIGGER financial_accounts_sync_bump
    BEFORE UPDATE ON financial_accounts
    FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'transactions_sync_bump') THEN
  CREATE TRIGGER transactions_sync_bump
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'transaction_line_items_sync_bump') THEN
  CREATE TRIGGER transaction_line_items_sync_bump
    BEFORE UPDATE ON transaction_line_items
    FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'transaction_templates_sync_bump') THEN
  CREATE TRIGGER transaction_templates_sync_bump
    BEFORE UPDATE ON transaction_templates
    FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'transaction_drafts_sync_bump') THEN
  CREATE TRIGGER transaction_drafts_sync_bump
    BEFORE UPDATE ON transaction_drafts
    FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'recurring_transaction_templates_sync_bump') THEN
  CREATE TRIGGER recurring_transaction_templates_sync_bump
    BEFORE UPDATE ON recurring_transaction_templates
    FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'recurring_transaction_occurrences_sync_bump') THEN
  CREATE TRIGGER recurring_transaction_occurrences_sync_bump
    BEFORE UPDATE ON recurring_transaction_occurrences
    FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();
END IF; END $$;

-- Indexes for sync pull performance (no WHERE deleted=false — pull must include tombstones)
CREATE INDEX IF NOT EXISTS idx_financial_accounts_updated_at
  ON financial_accounts (updated_at, id);

CREATE INDEX IF NOT EXISTS idx_transactions_updated_at
  ON transactions (updated_at, id);

CREATE INDEX IF NOT EXISTS idx_transaction_line_items_updated_at
  ON transaction_line_items (updated_at, id);

CREATE INDEX IF NOT EXISTS idx_transaction_templates_updated_at
  ON transaction_templates (updated_at, id);

CREATE INDEX IF NOT EXISTS idx_transaction_drafts_updated_at
  ON transaction_drafts (updated_at, id);

CREATE INDEX IF NOT EXISTS idx_recurring_transaction_templates_updated_at
  ON recurring_transaction_templates (updated_at, id);

CREATE INDEX IF NOT EXISTS idx_recurring_transaction_occurrences_updated_at
  ON recurring_transaction_occurrences (updated_at, id);
