CREATE OR REPLACE FUNCTION apply_debt_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_version integer;
  v_existing_user_id uuid;
  v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity <> 'debt_accounts' THEN
    SELECT * INTO v_result FROM apply_debt_sync_operation_hardened(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;
  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'unsupported operation'; END IF;
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN RAISE EXCEPTION 'invalid device id'; END IF;
  INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending')) ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT user_id INTO v_existing_user_id FROM applied_operations WHERE operation_id = p_operation_id;
    IF v_existing_user_id IS DISTINCT FROM v_user_id THEN RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[]; ELSE RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[]; END IF;
    RETURN;
  END IF;
  IF p_operation_type = 'create' THEN
    IF NULLIF(p_payload->>'name', '') IS NULL OR NULLIF(p_payload->>'preset_key', '') IS NULL THEN RAISE EXCEPTION 'name and preset_key are required'; END IF;
    IF p_payload->>'preset_key' NOT IN ('personal_loan', 'salary_loan', 'multipurpose_loan', 'business_loan', 'auto_loan', 'custom_debt') THEN RAISE EXCEPTION 'preset_key is not a supported non-credit-card debt type'; END IF;
    IF jsonb_typeof(COALESCE(p_payload->'preset_data', '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'preset_data must be an object'; END IF;
    IF COALESCE((p_payload->>'current_balance_centavos')::bigint, 0) > COALESCE((p_payload->>'original_balance_centavos')::bigint, 0) THEN RAISE EXCEPTION 'current balance cannot exceed original balance'; END IF;
    INSERT INTO debt_accounts (id, user_id, linked_account_id, name, lender_name, preset_key, status, original_balance_centavos, current_balance_centavos, annual_interest_rate_bps, minimum_payment_centavos, payment_frequency, next_due_date, maturity_date, target_payoff_date, interest_period, interest_method, preset_data, notes, version, deleted, updated_at)
    VALUES (p_record_id, v_user_id, NULLIF(p_payload->>'linked_account_id', '')::uuid, p_payload->>'name', p_payload->>'lender_name', p_payload->>'preset_key', 'active', COALESCE((p_payload->>'original_balance_centavos')::bigint, 0), COALESCE((p_payload->>'current_balance_centavos')::bigint, 0), COALESCE((p_payload->>'annual_interest_rate_bps')::integer, 0), COALESCE((p_payload->>'minimum_payment_centavos')::bigint, 0), COALESCE(p_payload->>'payment_frequency', 'monthly'), NULLIF(p_payload->>'next_due_date', '')::date, NULLIF(p_payload->>'maturity_date', '')::date, NULLIF(p_payload->>'target_payoff_date', '')::date, p_payload->>'interest_period', p_payload->>'interest_method', COALESCE(p_payload->'preset_data', '{}'::jsonb), p_payload->>'notes', 1, false, now());
    v_version := 1;
  ELSE
    SELECT version INTO v_version FROM debt_accounts WHERE id = p_record_id AND user_id = v_user_id AND deleted = false FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'debt not found or inaccessible'; END IF;
    IF p_base_version IS NOT NULL AND p_base_version <> v_version THEN DELETE FROM applied_operations WHERE operation_id = p_operation_id; RETURN QUERY SELECT 'conflict'::text, 'debt version changed'::text, v_version, p_changed_fields; RETURN; END IF;
    IF p_operation_type = 'delete' THEN
      UPDATE debt_accounts SET status = 'deleted', deleted = true, deleted_at = now(), version = v_version + 1, updated_at = now() WHERE id = p_record_id AND user_id = v_user_id;
    ELSE
      UPDATE debt_accounts SET linked_account_id = CASE WHEN p_payload ? 'linked_account_id' THEN NULLIF(p_payload->>'linked_account_id', '')::uuid ELSE linked_account_id END, name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END, lender_name = CASE WHEN p_payload ? 'lender_name' THEN p_payload->>'lender_name' ELSE lender_name END, preset_key = CASE WHEN p_payload ? 'preset_key' THEN p_payload->>'preset_key' ELSE preset_key END, status = CASE WHEN p_payload ? 'status' THEN (p_payload->>'status')::odin_debt_account_status ELSE status END, original_balance_centavos = CASE WHEN p_payload ? 'original_balance_centavos' THEN (p_payload->>'original_balance_centavos')::bigint ELSE original_balance_centavos END, current_balance_centavos = CASE WHEN p_payload ? 'current_balance_centavos' THEN (p_payload->>'current_balance_centavos')::bigint ELSE current_balance_centavos END, annual_interest_rate_bps = CASE WHEN p_payload ? 'annual_interest_rate_bps' THEN (p_payload->>'annual_interest_rate_bps')::integer ELSE annual_interest_rate_bps END, minimum_payment_centavos = CASE WHEN p_payload ? 'minimum_payment_centavos' THEN (p_payload->>'minimum_payment_centavos')::bigint ELSE minimum_payment_centavos END, payment_frequency = CASE WHEN p_payload ? 'payment_frequency' THEN p_payload->>'payment_frequency' ELSE payment_frequency END, next_due_date = CASE WHEN p_payload ? 'next_due_date' THEN NULLIF(p_payload->>'next_due_date', '')::date ELSE next_due_date END, maturity_date = CASE WHEN p_payload ? 'maturity_date' THEN NULLIF(p_payload->>'maturity_date', '')::date ELSE maturity_date END, target_payoff_date = CASE WHEN p_payload ? 'target_payoff_date' THEN NULLIF(p_payload->>'target_payoff_date', '')::date ELSE target_payoff_date END, interest_period = CASE WHEN p_payload ? 'interest_period' THEN p_payload->>'interest_period' ELSE interest_period END, interest_method = CASE WHEN p_payload ? 'interest_method' THEN p_payload->>'interest_method' ELSE interest_method END, preset_data = CASE WHEN p_payload ? 'preset_data' THEN p_payload->'preset_data' ELSE preset_data END, notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END, archived_at = CASE WHEN p_payload->>'status' = 'archived' THEN COALESCE(archived_at, now()) WHEN p_payload ? 'status' THEN NULL ELSE archived_at END, paid_off_at = CASE WHEN p_payload->>'status' = 'paid_off' THEN COALESCE(paid_off_at, now()) WHEN p_payload ? 'status' THEN NULL ELSE paid_off_at END, version = v_version + 1, updated_at = now() WHERE id = p_record_id AND user_id = v_user_id;
    END IF;
    v_version := v_version + 1;
  END IF;
  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_version) WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_version, NULL::text[];
END;
$$;

GRANT EXECUTE ON FUNCTION apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
