ALTER TABLE public.savings_account_details
  ADD COLUMN IF NOT EXISTS boosted_interest_rate_bps integer CHECK (boosted_interest_rate_bps >= 0),
  ADD COLUMN IF NOT EXISTS interest_calculation_basis text CHECK (interest_calculation_basis IN ('daily_ending_balance', 'average_daily_balance', 'monthly_average_balance')),
  ADD COLUMN IF NOT EXISTS interest_credit_frequency text CHECK (interest_credit_frequency IN ('monthly', 'quarterly', 'at_maturity')),
  ADD COLUMN IF NOT EXISTS maximum_eligible_balance_centavos bigint CHECK (maximum_eligible_balance_centavos >= 0),
  ADD COLUMN IF NOT EXISTS balance_tiers jsonb,
  ADD COLUMN IF NOT EXISTS required_deposit_centavos bigint CHECK (required_deposit_centavos >= 0),
  ADD COLUMN IF NOT EXISTS required_deposit_frequency text CHECK (required_deposit_frequency IN ('monthly', 'quarterly', 'custom')),
  ADD COLUMN IF NOT EXISTS required_transaction_count integer CHECK (required_transaction_count > 0),
  ADD COLUMN IF NOT EXISTS required_transaction_period text CHECK (required_transaction_period IN ('monthly', 'quarterly', 'custom')),
  ADD COLUMN IF NOT EXISTS direct_deposit_threshold_centavos bigint CHECK (direct_deposit_threshold_centavos >= 0),
  ADD COLUMN IF NOT EXISTS qualification_period text CHECK (qualification_period IN ('monthly', 'quarterly', 'custom')),
  ADD COLUMN IF NOT EXISTS promotional_interest_rate_bps integer CHECK (promotional_interest_rate_bps >= 0),
  ADD COLUMN IF NOT EXISTS promotion_start_date date,
  ADD COLUMN IF NOT EXISTS promotion_end_date date,
  ADD CONSTRAINT savings_account_details_hysa_promotion_dates_check CHECK (
    promotion_end_date IS NULL OR promotion_start_date IS NOT NULL AND promotion_end_date >= promotion_start_date
  );

CREATE OR REPLACE FUNCTION private.apply_hysa_yield_input_sync_operation(
  p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text,
  p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  v_hysa_fields text[] := ARRAY['boosted_interest_rate_bps', 'interest_calculation_basis', 'interest_credit_frequency', 'maximum_eligible_balance_centavos', 'balance_tiers', 'required_deposit_centavos', 'required_deposit_frequency', 'required_transaction_count', 'required_transaction_period', 'direct_deposit_threshold_centavos', 'qualification_period', 'promotional_interest_rate_bps', 'promotion_start_date', 'promotion_end_date'];
  v_previous boolean;
  v_base_fields text[];
  v_result record;
BEGIN
  SELECT EXISTS(SELECT 1 FROM applied_operations WHERE operation_id = p_operation_id AND user_id = auth.uid()) INTO v_previous;
  SELECT COALESCE(array_agg(field), ARRAY[]::text[]) INTO v_base_fields
  FROM unnest(COALESCE(p_changed_fields, ARRAY[]::text[])) AS field
  WHERE NOT (field = ANY(v_hysa_fields));
  SELECT * INTO v_result FROM private.apply_legacy_savings_account_detail_sync_operation(
    p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version, v_base_fields, p_payload
  );
  IF v_previous OR v_result.status <> 'applied' OR p_operation_type = 'delete' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;
  UPDATE savings_account_details SET
    boosted_interest_rate_bps = CASE WHEN p_operation_type = 'create' OR 'boosted_interest_rate_bps' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'boosted_interest_rate_bps', '')::integer ELSE boosted_interest_rate_bps END,
    interest_calculation_basis = CASE WHEN p_operation_type = 'create' OR 'interest_calculation_basis' = ANY(p_changed_fields) THEN p_payload->>'interest_calculation_basis' ELSE interest_calculation_basis END,
    interest_credit_frequency = CASE WHEN p_operation_type = 'create' OR 'interest_credit_frequency' = ANY(p_changed_fields) THEN p_payload->>'interest_credit_frequency' ELSE interest_credit_frequency END,
    maximum_eligible_balance_centavos = CASE WHEN p_operation_type = 'create' OR 'maximum_eligible_balance_centavos' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'maximum_eligible_balance_centavos', '')::bigint ELSE maximum_eligible_balance_centavos END,
    balance_tiers = CASE WHEN p_operation_type = 'create' OR 'balance_tiers' = ANY(p_changed_fields) THEN p_payload->'balance_tiers' ELSE balance_tiers END,
    required_deposit_centavos = CASE WHEN p_operation_type = 'create' OR 'required_deposit_centavos' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'required_deposit_centavos', '')::bigint ELSE required_deposit_centavos END,
    required_deposit_frequency = CASE WHEN p_operation_type = 'create' OR 'required_deposit_frequency' = ANY(p_changed_fields) THEN p_payload->>'required_deposit_frequency' ELSE required_deposit_frequency END,
    required_transaction_count = CASE WHEN p_operation_type = 'create' OR 'required_transaction_count' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'required_transaction_count', '')::integer ELSE required_transaction_count END,
    required_transaction_period = CASE WHEN p_operation_type = 'create' OR 'required_transaction_period' = ANY(p_changed_fields) THEN p_payload->>'required_transaction_period' ELSE required_transaction_period END,
    direct_deposit_threshold_centavos = CASE WHEN p_operation_type = 'create' OR 'direct_deposit_threshold_centavos' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'direct_deposit_threshold_centavos', '')::bigint ELSE direct_deposit_threshold_centavos END,
    qualification_period = CASE WHEN p_operation_type = 'create' OR 'qualification_period' = ANY(p_changed_fields) THEN p_payload->>'qualification_period' ELSE qualification_period END,
    promotional_interest_rate_bps = CASE WHEN p_operation_type = 'create' OR 'promotional_interest_rate_bps' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'promotional_interest_rate_bps', '')::integer ELSE promotional_interest_rate_bps END,
    promotion_start_date = CASE WHEN p_operation_type = 'create' OR 'promotion_start_date' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'promotion_start_date', '')::date ELSE promotion_start_date END,
    promotion_end_date = CASE WHEN p_operation_type = 'create' OR 'promotion_end_date' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'promotion_end_date', '')::date ELSE promotion_end_date END
  WHERE account_id = p_record_id AND user_id = auth.uid();
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_sync_operation_before_hysa_yield_inputs;

CREATE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF p_entity = 'savings_account_details' THEN
    RETURN QUERY SELECT * FROM private.apply_hysa_yield_input_sync_operation(p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.apply_sync_operation_before_hysa_yield_inputs(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
END;
$$;

REVOKE EXECUTE ON FUNCTION private.apply_hysa_yield_input_sync_operation(uuid, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
