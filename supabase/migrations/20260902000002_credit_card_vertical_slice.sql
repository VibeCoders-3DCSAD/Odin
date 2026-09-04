-- Credit cards are financial accounts; these tables hold Debt Manager detail.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS credit_card_posting_date date;

CREATE TABLE IF NOT EXISTS credit_card_details (
  account_id uuid PRIMARY KEY REFERENCES financial_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  issuer text,
  credit_limit_centavos bigint NOT NULL CHECK (credit_limit_centavos > 0),
  available_credit_centavos bigint CHECK (available_credit_centavos IS NULL OR available_credit_centavos >= 0),
  default_cutoff_date date NOT NULL,
  default_statement_date date NOT NULL,
  notes text,
  version integer NOT NULL DEFAULT 1, deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz,
  UNIQUE(account_id, user_id)
);
CREATE TABLE IF NOT EXISTS credit_card_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE, cycle_start_date date NOT NULL,
  cutoff_date date NOT NULL, statement_date date NOT NULL,
  version integer NOT NULL DEFAULT 1, deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz,
  UNIQUE(user_id, account_id, cycle_start_date), CHECK (cycle_start_date <= cutoff_date AND cutoff_date <= statement_date)
);
CREATE TABLE IF NOT EXISTS credit_card_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE, transaction_id uuid,
  description text NOT NULL, original_principal_centavos bigint NOT NULL CHECK (original_principal_centavos > 0),
  remaining_principal_centavos bigint NOT NULL CHECK (remaining_principal_centavos >= 0 AND remaining_principal_centavos <= original_principal_centavos),
  term_months integer NOT NULL CHECK (term_months > 0), remaining_months integer NOT NULL CHECK (remaining_months >= 0 AND remaining_months <= term_months),
  monthly_amortization_centavos bigint NOT NULL CHECK (monthly_amortization_centavos > 0), interest_rate_bps integer NOT NULL DEFAULT 0 CHECK (interest_rate_bps >= 0),
  interest_type text NOT NULL CHECK (interest_type IN ('zero_interest', 'interest_bearing')),
  settlement_status text NOT NULL DEFAULT 'active' CHECK (settlement_status IN ('active', 'settlement_requested', 'completed')),
  version integer NOT NULL DEFAULT 1, deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz
);
CREATE TABLE IF NOT EXISTS credit_card_transactions (
  transaction_id uuid PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE, cycle_id uuid NOT NULL REFERENCES credit_card_cycles(id) ON DELETE RESTRICT,
  purchase_type text NOT NULL CHECK (purchase_type IN ('regular', 'installment')), installment_id uuid REFERENCES credit_card_installments(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1, deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz
);
CREATE TABLE IF NOT EXISTS credit_card_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES credit_card_cycles(id) ON DELETE CASCADE, statement_balance_centavos bigint NOT NULL CHECK (statement_balance_centavos >= 0),
  minimum_due_centavos bigint NOT NULL CHECK (minimum_due_centavos >= 0 AND minimum_due_centavos <= statement_balance_centavos), finance_charge_centavos bigint NOT NULL DEFAULT 0 CHECK (finance_charge_centavos >= 0),
  due_date date NOT NULL, authoritative boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1, deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz
);
CREATE TABLE IF NOT EXISTS credit_card_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES credit_card_cycles(id) ON DELETE CASCADE, statement_id uuid REFERENCES credit_card_statements(id) ON DELETE SET NULL, transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  amount_centavos bigint NOT NULL CHECK (amount_centavos > 0), payment_date date NOT NULL, source_account_id uuid REFERENCES financial_accounts(id) ON DELETE SET NULL, notes text,
  version integer NOT NULL DEFAULT 1, deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz
);
CREATE TABLE IF NOT EXISTS credit_card_credit_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE, payment_id uuid NOT NULL REFERENCES credit_card_payments(id) ON DELETE CASCADE, amount_centavos bigint NOT NULL CHECK (amount_centavos > 0), applied_date date NOT NULL, target_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1, deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz
);
CREATE TABLE IF NOT EXISTS credit_card_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE, installment_id uuid NOT NULL REFERENCES credit_card_installments(id) ON DELETE CASCADE,
  settlement_date date NOT NULL, remaining_principal_centavos bigint NOT NULL CHECK (remaining_principal_centavos >= 0), settlement_amount_centavos bigint NOT NULL CHECK (settlement_amount_centavos > 0), pretermination_fee_centavos bigint NOT NULL DEFAULT 0 CHECK (pretermination_fee_centavos >= 0),
  status text NOT NULL CHECK (status IN ('requested', 'recognized', 'rejected')), version integer NOT NULL DEFAULT 1, deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz
);
CREATE TABLE IF NOT EXISTS credit_card_statement_strategies (
  statement_id uuid PRIMARY KEY REFERENCES credit_card_statements(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  strategy text NOT NULL CHECK (strategy IN ('pay_full', 'pay_minimum', 'custom')), custom_amount_centavos bigint CHECK (custom_amount_centavos IS NULL OR custom_amount_centavos > 0),
  version integer NOT NULL DEFAULT 1, deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz
);

CREATE INDEX IF NOT EXISTS credit_card_cycles_pull_idx ON credit_card_cycles(updated_at, id);
CREATE INDEX IF NOT EXISTS credit_card_statements_pull_idx ON credit_card_statements(updated_at, id);
CREATE INDEX IF NOT EXISTS credit_card_payments_pull_idx ON credit_card_payments(updated_at, id);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['credit_card_details','credit_card_cycles','credit_card_installments','credit_card_transactions','credit_card_statements','credit_card_payments','credit_card_credit_applications','credit_card_settlements','credit_card_statement_strategies'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_user_policy ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_user_policy ON %I USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION assert_credit_card_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM financial_accounts WHERE id = NEW.account_id AND user_id = NEW.user_id AND kind = 'credit_card' AND deleted = false) THEN RAISE EXCEPTION 'account is not an accessible credit card'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS credit_card_details_account_guard ON credit_card_details;
CREATE TRIGGER credit_card_details_account_guard BEFORE INSERT OR UPDATE ON credit_card_details FOR EACH ROW EXECUTE FUNCTION assert_credit_card_account();
DROP TRIGGER IF EXISTS credit_card_cycles_account_guard ON credit_card_cycles;
CREATE TRIGGER credit_card_cycles_account_guard BEFORE INSERT OR UPDATE ON credit_card_cycles FOR EACH ROW EXECUTE FUNCTION assert_credit_card_account();
DROP TRIGGER IF EXISTS credit_card_transactions_account_guard ON credit_card_transactions;
CREATE TRIGGER credit_card_transactions_account_guard BEFORE INSERT OR UPDATE ON credit_card_transactions FOR EACH ROW EXECUTE FUNCTION assert_credit_card_account();

-- The payload is first filtered by the API allowlist. The fixed table allowlist
-- here keeps the dynamic SQL identifier safe while preserving sync idempotency.
CREATE OR REPLACE FUNCTION apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_user uuid := auth.uid(); v_payload jsonb; v_version integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity NOT IN ('credit_card_details','credit_card_cycles','credit_card_installments','credit_card_transactions','credit_card_statements','credit_card_payments','credit_card_credit_applications','credit_card_settlements','credit_card_statement_strategies') THEN RAISE EXCEPTION 'entity is not a credit-card entity'; END IF;
  IF p_operation_type NOT IN ('create','update','delete') THEN RAISE EXCEPTION 'unsupported operation'; END IF;
  INSERT INTO applied_operations(operation_id,user_id,device_id,entity,record_id,operation_type,result)
  VALUES(p_operation_id,v_user,p_device_id,p_entity,p_record_id,p_operation_type,jsonb_build_object('status','pending')) ON CONFLICT(operation_id) DO NOTHING;
  IF NOT FOUND THEN RETURN QUERY SELECT 'duplicate'::text,NULL::text,NULL::integer,NULL::text[]; RETURN; END IF;
  v_payload := jsonb_set(p_payload, '{user_id}', to_jsonb(v_user), true);
  IF p_entity = 'credit_card_details' THEN v_payload := jsonb_set(v_payload, '{account_id}', COALESCE(v_payload->'account_id', to_jsonb(p_record_id)), true); END IF;
  IF p_operation_type = 'delete' THEN
    EXECUTE format('UPDATE %I SET deleted=true, updated_at=now(), version=version+1 WHERE user_id=$1 AND %s=$2', p_entity, CASE WHEN p_entity='credit_card_details' OR p_entity='credit_card_statement_strategies' THEN 'account_id' ELSE 'id' END) USING v_user, p_record_id;
  ELSE
    EXECUTE format('DELETE FROM %I WHERE user_id=$1 AND %s=$2', p_entity, CASE WHEN p_entity='credit_card_details' THEN 'account_id' WHEN p_entity='credit_card_statement_strategies' THEN 'statement_id' ELSE 'id' END) USING v_user, CASE WHEN p_entity='credit_card_details' THEN (v_payload->>'account_id')::uuid WHEN p_entity='credit_card_statement_strategies' THEN (v_payload->>'statement_id')::uuid ELSE p_record_id END;
    EXECUTE format('INSERT INTO %I SELECT (jsonb_populate_record(NULL::%I, $1)).*', p_entity, p_entity) USING v_payload;
  END IF;
  UPDATE applied_operations SET result=jsonb_build_object('status','applied') WHERE operation_id=p_operation_id;
  RETURN QUERY SELECT 'applied'::text,NULL::text,1,NULL::text[];
END $$;
GRANT EXECUTE ON FUNCTION apply_credit_card_sync_operation(uuid,text,text,uuid,text,integer,text[],jsonb) TO authenticated;
