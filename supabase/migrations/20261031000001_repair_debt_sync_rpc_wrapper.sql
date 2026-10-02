-- The prior account-setting migration replaced the hardened wrapper after its
-- implementation moved to private, leaving priority sync unable to resolve it.
-- Alias table columns because RETURNS TABLE(status ...) otherwise shadows status.
CREATE OR REPLACE FUNCTION public.apply_debt_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_version integer;
  v_existing_user_id uuid;
  v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity <> 'debt_accounts' THEN
    SELECT * INTO v_result FROM private.apply_debt_sync_operation_hardened(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;

  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'unsupported operation'; END IF;
  IF p_payload ? 'allows_extra_payments' AND jsonb_typeof(p_payload->'allows_extra_payments') <> 'boolean' THEN RAISE EXCEPTION 'allows_extra_payments must be a boolean'; END IF;
  IF p_payload ? 'payment_schedule' AND jsonb_typeof(p_payload->'payment_schedule') <> 'object' THEN RAISE EXCEPTION 'payment_schedule must be an object'; END IF;
  IF p_payload ? 'payment_schedule' AND p_payload->'payment_schedule' ? 'customIntervalDays' AND COALESCE(p_payload->'payment_schedule'->>'customIntervalDays', '') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'custom payment interval is invalid'; END IF;
  IF p_payload ? 'payment_schedule' AND p_payload->'payment_schedule' ? 'semiMonthlyDays' AND (jsonb_typeof(p_payload->'payment_schedule'->'semiMonthlyDays') <> 'array' OR jsonb_array_length(p_payload->'payment_schedule'->'semiMonthlyDays') <> 2 OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_payload->'payment_schedule'->'semiMonthlyDays') AS day WHERE day !~ '^(?:[1-9]|1[0-9]|2[0-8])$') OR p_payload->'payment_schedule'->'semiMonthlyDays'->>0 = p_payload->'payment_schedule'->'semiMonthlyDays'->>1) THEN RAISE EXCEPTION 'semi-monthly payment days are invalid'; END IF;
  IF p_payload->>'payment_frequency' = 'custom' AND COALESCE(p_payload->'payment_schedule'->>'customIntervalDays', '') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'custom payment interval is required'; END IF;

  INSERT INTO public.applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
  ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT operation.user_id INTO v_existing_user_id FROM public.applied_operations AS operation WHERE operation.operation_id = p_operation_id;
    IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
    ELSE
      RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
    END IF;
    RETURN;
  END IF;

  IF p_operation_type = 'create' THEN
    IF NULLIF(p_payload->>'name', '') IS NULL OR NULLIF(p_payload->>'preset_key', '') IS NULL THEN RAISE EXCEPTION 'name and preset_key are required'; END IF;
    INSERT INTO public.debt_accounts (
      id, user_id, linked_account_id, name, lender_name, preset_key, status,
      original_balance_centavos, current_balance_centavos, annual_interest_rate_bps,
      minimum_payment_centavos, allows_extra_payments, payment_frequency,
      payment_schedule, next_due_date, maturity_date, target_payoff_date,
      interest_period, interest_method, preset_data, notes, version, deleted, updated_at
    ) VALUES (
      p_record_id, v_user_id, NULLIF(p_payload->>'linked_account_id', '')::uuid,
      p_payload->>'name', p_payload->>'lender_name', p_payload->>'preset_key', 'active',
      COALESCE((p_payload->>'original_balance_centavos')::bigint, 0),
      COALESCE((p_payload->>'current_balance_centavos')::bigint, 0),
      COALESCE((p_payload->>'annual_interest_rate_bps')::integer, 0),
      COALESCE((p_payload->>'minimum_payment_centavos')::bigint, 0),
      COALESCE((p_payload->>'allows_extra_payments')::boolean, false),
      COALESCE(p_payload->>'payment_frequency', 'monthly'),
      COALESCE(p_payload->'payment_schedule', '{}'::jsonb),
      NULLIF(p_payload->>'next_due_date', '')::date, NULLIF(p_payload->>'maturity_date', '')::date,
      NULLIF(p_payload->>'target_payoff_date', '')::date, p_payload->>'interest_period',
      p_payload->>'interest_method', COALESCE(p_payload->'preset_data', '{}'::jsonb),
      p_payload->>'notes', 1, false, now()
    );
    v_version := 1;
  ELSE
    SELECT account.version INTO v_version FROM public.debt_accounts AS account WHERE account.id = p_record_id AND account.user_id = v_user_id AND account.deleted = false FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'debt not found or inaccessible'; END IF;
    IF p_base_version IS NOT NULL AND p_base_version <> v_version THEN
      DELETE FROM public.applied_operations AS operation WHERE operation.operation_id = p_operation_id;
      RETURN QUERY SELECT 'conflict'::text, 'debt version changed'::text, v_version, p_changed_fields;
      RETURN;
    END IF;
    IF p_operation_type = 'delete' THEN
      UPDATE public.debt_accounts AS account SET status = 'deleted', deleted = true, version = v_version + 1, updated_at = now() WHERE account.id = p_record_id AND account.user_id = v_user_id;
    ELSE
      UPDATE public.debt_accounts AS account SET
        linked_account_id = CASE WHEN p_payload ? 'linked_account_id' THEN NULLIF(p_payload->>'linked_account_id', '')::uuid ELSE account.linked_account_id END,
        name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE account.name END,
        lender_name = CASE WHEN p_payload ? 'lender_name' THEN p_payload->>'lender_name' ELSE account.lender_name END,
        preset_key = CASE WHEN p_payload ? 'preset_key' THEN p_payload->>'preset_key' ELSE account.preset_key END,
        status = CASE WHEN p_payload ? 'status' THEN (p_payload->>'status')::public.odin_debt_account_status ELSE account.status END,
        original_balance_centavos = CASE WHEN p_payload ? 'original_balance_centavos' THEN (p_payload->>'original_balance_centavos')::bigint ELSE account.original_balance_centavos END,
        current_balance_centavos = CASE WHEN p_payload ? 'current_balance_centavos' THEN (p_payload->>'current_balance_centavos')::bigint ELSE account.current_balance_centavos END,
        annual_interest_rate_bps = CASE WHEN p_payload ? 'annual_interest_rate_bps' THEN (p_payload->>'annual_interest_rate_bps')::integer ELSE account.annual_interest_rate_bps END,
        minimum_payment_centavos = CASE WHEN p_payload ? 'minimum_payment_centavos' THEN (p_payload->>'minimum_payment_centavos')::bigint ELSE account.minimum_payment_centavos END,
        allows_extra_payments = CASE WHEN p_payload ? 'allows_extra_payments' THEN (p_payload->>'allows_extra_payments')::boolean ELSE account.allows_extra_payments END,
        payment_frequency = CASE WHEN p_payload ? 'payment_frequency' THEN p_payload->>'payment_frequency' ELSE account.payment_frequency END,
        payment_schedule = CASE WHEN p_payload ? 'payment_schedule' THEN p_payload->'payment_schedule' ELSE account.payment_schedule END,
        next_due_date = CASE WHEN p_payload ? 'next_due_date' THEN NULLIF(p_payload->>'next_due_date', '')::date ELSE account.next_due_date END,
        maturity_date = CASE WHEN p_payload ? 'maturity_date' THEN NULLIF(p_payload->>'maturity_date', '')::date ELSE account.maturity_date END,
        target_payoff_date = CASE WHEN p_payload ? 'target_payoff_date' THEN NULLIF(p_payload->>'target_payoff_date', '')::date ELSE account.target_payoff_date END,
        interest_period = CASE WHEN p_payload ? 'interest_period' THEN p_payload->>'interest_period' ELSE account.interest_period END,
        interest_method = CASE WHEN p_payload ? 'interest_method' THEN p_payload->>'interest_method' ELSE account.interest_method END,
        preset_data = CASE WHEN p_payload ? 'preset_data' THEN p_payload->'preset_data' ELSE account.preset_data END,
        notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE account.notes END,
        archived_at = CASE WHEN p_payload->>'status' = 'archived' THEN COALESCE(account.archived_at, now()) WHEN p_payload ? 'status' THEN NULL ELSE account.archived_at END,
        paid_off_at = CASE WHEN p_payload->>'status' = 'paid_off' THEN COALESCE(account.paid_off_at, now()) WHEN p_payload ? 'status' THEN NULL ELSE account.paid_off_at END,
        version = v_version + 1, updated_at = now()
      WHERE account.id = p_record_id AND account.user_id = v_user_id;
    END IF;
    v_version := v_version + 1;
  END IF;

  UPDATE public.applied_operations AS operation SET result = jsonb_build_object('status', 'applied', 'current_version', v_version) WHERE operation.operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_version, NULL::text[];
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
