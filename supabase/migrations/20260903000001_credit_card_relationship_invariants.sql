ALTER TABLE credit_card_transactions ADD COLUMN IF NOT EXISTS client_mutation_id text;
ALTER TABLE credit_card_payments ADD COLUMN IF NOT EXISTS client_mutation_id text;
ALTER TABLE credit_card_credit_applications ADD COLUMN IF NOT EXISTS client_mutation_id text;
ALTER TABLE credit_card_transactions ADD COLUMN IF NOT EXISTS applied_credit_centavos bigint NOT NULL DEFAULT 0 CHECK (applied_credit_centavos >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS credit_card_transactions_mutation_idx ON credit_card_transactions(user_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS credit_card_payments_mutation_idx ON credit_card_payments(user_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS credit_card_applications_mutation_idx ON credit_card_credit_applications(user_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS credit_card_one_live_statement_per_cycle_idx ON credit_card_statements(cycle_id) WHERE deleted=false;

CREATE OR REPLACE FUNCTION assert_credit_card_relationships() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'credit_card_transactions' AND (NOT EXISTS (SELECT 1 FROM transactions WHERE id=NEW.transaction_id AND user_id=NEW.user_id AND deleted=false) OR NOT EXISTS (SELECT 1 FROM credit_card_cycles WHERE id=NEW.cycle_id AND account_id=NEW.account_id AND user_id=NEW.user_id AND deleted=false)) THEN RAISE EXCEPTION 'credit-card transaction relationship is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_statements' AND NOT EXISTS (SELECT 1 FROM credit_card_cycles WHERE id=NEW.cycle_id AND user_id=NEW.user_id AND deleted=false) THEN RAISE EXCEPTION 'statement cycle is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_payments' AND (NOT EXISTS (SELECT 1 FROM credit_card_cycles WHERE id=NEW.cycle_id AND user_id=NEW.user_id AND deleted=false) OR (NEW.statement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM credit_card_statements WHERE id=NEW.statement_id AND cycle_id=NEW.cycle_id AND user_id=NEW.user_id AND deleted=false)) OR (NEW.source_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financial_accounts WHERE id=NEW.source_account_id AND user_id=NEW.user_id AND deleted=false))) THEN RAISE EXCEPTION 'payment relationship is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_installments' AND NEW.transaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM transactions WHERE id=NEW.transaction_id AND user_id=NEW.user_id AND deleted=false) THEN RAISE EXCEPTION 'installment transaction is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_credit_applications' AND (NOT EXISTS (SELECT 1 FROM credit_card_payments p JOIN credit_card_cycles c ON c.id=p.cycle_id WHERE p.id=NEW.payment_id AND p.user_id=NEW.user_id AND c.account_id=NEW.account_id AND p.deleted=false) OR (NEW.target_transaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM credit_card_transactions WHERE transaction_id=NEW.target_transaction_id AND account_id=NEW.account_id AND user_id=NEW.user_id AND deleted=false))) THEN RAISE EXCEPTION 'credit application relationship is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_settlements' AND NOT EXISTS (SELECT 1 FROM credit_card_installments WHERE id=NEW.installment_id AND user_id=NEW.user_id AND deleted=false) THEN RAISE EXCEPTION 'settlement installment is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_statement_strategies' AND NOT EXISTS (SELECT 1 FROM credit_card_statements WHERE id=NEW.statement_id AND user_id=NEW.user_id AND deleted=false) THEN RAISE EXCEPTION 'strategy statement is inaccessible'; END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['credit_card_transactions','credit_card_statements','credit_card_payments','credit_card_installments','credit_card_credit_applications','credit_card_settlements','credit_card_statement_strategies'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_relationship_guard ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_relationship_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION assert_credit_card_relationships()', t, t);
  END LOOP;
END $$;
