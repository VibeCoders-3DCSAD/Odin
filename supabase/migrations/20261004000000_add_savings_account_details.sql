CREATE TABLE public.savings_account_details (
  account_id uuid PRIMARY KEY REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type text NOT NULL CHECK (account_type IN ('personal_savings', 'high_yield_savings', 'time_deposit')),
  interest_rate_bps integer CHECK (interest_rate_bps >= 0),
  minimum_balance_centavos bigint CHECK (minimum_balance_centavos >= 0),
  base_interest_rate_bps integer CHECK (base_interest_rate_bps >= 0),
  effective_interest_rate_bps integer CHECK (effective_interest_rate_bps >= 0),
  interest_conditions text CHECK (interest_conditions IS NULL OR length(interest_conditions) <= 1000),
  higher_rate_eligible boolean,
  principal_centavos bigint CHECK (principal_centavos IS NULL OR principal_centavos > 0),
  maturity_date date,
  term_months integer CHECK (term_months IS NULL OR term_months > 0),
  early_withdrawal_rule text CHECK (early_withdrawal_rule IS NULL OR length(early_withdrawal_rule) <= 1000),
  version integer NOT NULL DEFAULT 1,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz
);

CREATE INDEX savings_account_details_user_active_idx ON public.savings_account_details(user_id, deleted, account_type);
ALTER TABLE public.savings_account_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage their savings account details" ON public.savings_account_details
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO public.savings_account_details (account_id, user_id, account_type, version, deleted)
SELECT id, user_id, 'personal_savings', 1, false FROM public.financial_accounts
WHERE kind = 'savings' AND deleted = false
ON CONFLICT (account_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.apply_savings_account_detail_sync_operation(
  p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text,
  p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_version integer;
  v_existing_user_id uuid;
  v_existing_result jsonb;
  v_type text := p_payload->>'account_type';
  v_allowed_fields text[] := ARRAY['account_type', 'interest_rate_bps', 'minimum_balance_centavos', 'base_interest_rate_bps', 'effective_interest_rate_bps', 'interest_conditions', 'higher_rate_eligible', 'principal_centavos', 'maturity_date', 'term_months', 'early_withdrawal_rule'];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'operation type is invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id AND kind = 'savings' AND deleted = false) THEN
    RAISE EXCEPTION 'savings account details require an owned savings account';
  END IF;

  INSERT INTO applied_operations(operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, 'savings_account_details', p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
  ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT user_id, result INTO v_existing_user_id, v_existing_result FROM applied_operations WHERE operation_id = p_operation_id;
    IF v_existing_user_id IS DISTINCT FROM v_user_id THEN RETURN QUERY SELECT 'rejected', 'operation belongs to another user', NULL::integer, NULL::text[]; ELSE RETURN QUERY SELECT COALESCE(v_existing_result->>'status', 'duplicate'), NULLIF(v_existing_result->>'reason', ''), (v_existing_result->>'current_version')::integer, NULL::text[]; END IF;
    RETURN;
  END IF;

  IF p_operation_type = 'create' THEN
    IF p_base_version IS NOT NULL OR v_type NOT IN ('personal_savings', 'high_yield_savings', 'time_deposit') THEN RAISE EXCEPTION 'invalid savings account detail payload'; END IF;
    INSERT INTO savings_account_details(account_id, user_id, account_type, interest_rate_bps, minimum_balance_centavos, base_interest_rate_bps, effective_interest_rate_bps, interest_conditions, higher_rate_eligible, principal_centavos, maturity_date, term_months, early_withdrawal_rule, version, deleted)
    VALUES (p_record_id, v_user_id, v_type, NULLIF(p_payload->>'interest_rate_bps', '')::integer, NULLIF(p_payload->>'minimum_balance_centavos', '')::bigint, NULLIF(p_payload->>'base_interest_rate_bps', '')::integer, NULLIF(p_payload->>'effective_interest_rate_bps', '')::integer, p_payload->>'interest_conditions', CASE WHEN p_payload ? 'higher_rate_eligible' THEN (p_payload->>'higher_rate_eligible')::boolean ELSE NULL END, NULLIF(p_payload->>'principal_centavos', '')::bigint, NULLIF(p_payload->>'maturity_date', '')::date, NULLIF(p_payload->>'term_months', '')::integer, p_payload->>'early_withdrawal_rule', 1, false)
    ON CONFLICT (account_id) DO UPDATE SET updated_at = savings_account_details.updated_at WHERE savings_account_details.user_id = v_user_id;
    UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', 1) WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'applied', NULL::text, 1, NULL::text[];
    RETURN;
  END IF;

  SELECT version INTO v_current_version FROM savings_account_details WHERE account_id = p_record_id AND user_id = v_user_id FOR UPDATE;
  IF v_current_version IS NULL THEN RETURN QUERY SELECT 'rejected', 'record not found', NULL::integer, NULL::text[]; RETURN; END IF;
  IF p_base_version IS NULL OR p_base_version <> v_current_version THEN RETURN QUERY SELECT 'conflict', 'savings account detail version changed', v_current_version, p_changed_fields; RETURN; END IF;
  IF p_operation_type = 'delete' THEN
    UPDATE savings_account_details SET deleted = true, version = version + 1, updated_at = now() WHERE account_id = p_record_id AND user_id = v_user_id;
  ELSE
    IF p_changed_fields IS NULL OR NOT (p_changed_fields <@ v_allowed_fields) THEN RAISE EXCEPTION 'invalid savings account detail fields'; END IF;
    UPDATE savings_account_details SET
      account_type = CASE WHEN 'account_type' = ANY(p_changed_fields) THEN p_payload->>'account_type' ELSE account_type END,
      interest_rate_bps = CASE WHEN 'interest_rate_bps' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'interest_rate_bps', '')::integer ELSE interest_rate_bps END,
      minimum_balance_centavos = CASE WHEN 'minimum_balance_centavos' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'minimum_balance_centavos', '')::bigint ELSE minimum_balance_centavos END,
      base_interest_rate_bps = CASE WHEN 'base_interest_rate_bps' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'base_interest_rate_bps', '')::integer ELSE base_interest_rate_bps END,
      effective_interest_rate_bps = CASE WHEN 'effective_interest_rate_bps' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'effective_interest_rate_bps', '')::integer ELSE effective_interest_rate_bps END,
      interest_conditions = CASE WHEN 'interest_conditions' = ANY(p_changed_fields) THEN p_payload->>'interest_conditions' ELSE interest_conditions END,
      higher_rate_eligible = CASE WHEN 'higher_rate_eligible' = ANY(p_changed_fields) THEN (p_payload->>'higher_rate_eligible')::boolean ELSE higher_rate_eligible END,
      principal_centavos = CASE WHEN 'principal_centavos' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'principal_centavos', '')::bigint ELSE principal_centavos END,
      maturity_date = CASE WHEN 'maturity_date' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'maturity_date', '')::date ELSE maturity_date END,
      term_months = CASE WHEN 'term_months' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'term_months', '')::integer ELSE term_months END,
      early_withdrawal_rule = CASE WHEN 'early_withdrawal_rule' = ANY(p_changed_fields) THEN p_payload->>'early_withdrawal_rule' ELSE early_withdrawal_rule END,
      version = version + 1, updated_at = now()
    WHERE account_id = p_record_id AND user_id = v_user_id;
  END IF;
  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_current_version + 1) WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied', NULL::text, v_current_version + 1, NULL::text[];
END;
$$;

ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) RENAME TO apply_sync_operation_before_savings_account_details;
CREATE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF p_entity = 'savings_account_details' THEN
    RETURN QUERY SELECT * FROM private.apply_savings_account_detail_sync_operation(p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.apply_sync_operation_before_savings_account_details(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
END;
$$;
REVOKE EXECUTE ON FUNCTION private.apply_savings_account_detail_sync_operation(uuid, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
