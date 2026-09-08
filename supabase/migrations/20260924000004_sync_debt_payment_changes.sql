-- Keep a debt payment and its linked transaction consistent when either is
-- edited or removed from Debt Manager while offline.
CREATE OR REPLACE FUNCTION apply_debt_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_payment debt_payments%ROWTYPE;
  v_balance bigint;
  v_amount bigint;
  v_transaction_amount bigint;
  v_version integer;
  v_existing_user_id uuid;
  v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity = 'debt_accounts' THEN
    IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'unsupported operation'; END IF;
    INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
    VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
    ON CONFLICT (operation_id) DO NOTHING;
    IF NOT FOUND THEN
      SELECT user_id INTO v_existing_user_id FROM applied_operations WHERE operation_id = p_operation_id;
      IF v_existing_user_id IS DISTINCT FROM v_user_id THEN RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
      ELSE RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[]; END IF;
      RETURN;
    END IF;
    IF p_operation_type = 'create' THEN
      INSERT INTO debt_accounts (id, user_id, linked_account_id, name, lender_name, preset_key, status, original_balance_centavos, current_balance_centavos, annual_interest_rate_bps, minimum_payment_centavos, payment_frequency, next_due_date, maturity_date, target_payoff_date, interest_period, interest_method, preset_data, notes, version, deleted, updated_at)
      VALUES (p_record_id, v_user_id, NULLIF(p_payload->>'linked_account_id', '')::uuid, p_payload->>'name', p_payload->>'lender_name', p_payload->>'preset_key', 'active', COALESCE((p_payload->>'original_balance_centavos')::bigint, 0), COALESCE((p_payload->>'current_balance_centavos')::bigint, 0), COALESCE((p_payload->>'annual_interest_rate_bps')::integer, 0), COALESCE((p_payload->>'minimum_payment_centavos')::bigint, 0), COALESCE(p_payload->>'payment_frequency', 'monthly'), NULLIF(p_payload->>'next_due_date', '')::date, NULLIF(p_payload->>'maturity_date', '')::date, NULLIF(p_payload->>'target_payoff_date', '')::date, p_payload->>'interest_period', p_payload->>'interest_method', COALESCE(p_payload->'preset_data', '{}'::jsonb), p_payload->>'notes', 1, false, now());
      v_version := 1;
    ELSE
      SELECT version INTO v_version FROM debt_accounts WHERE id = p_record_id AND user_id = v_user_id AND deleted = false FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'debt not found or inaccessible'; END IF;
      IF p_base_version IS NOT NULL AND p_base_version <> v_version THEN DELETE FROM applied_operations WHERE operation_id = p_operation_id; RETURN QUERY SELECT 'conflict'::text, 'debt version changed'::text, v_version, p_changed_fields; RETURN; END IF;
      IF p_operation_type = 'delete' THEN
        UPDATE debt_accounts SET status = 'deleted', deleted = true, version = v_version + 1, updated_at = now() WHERE id = p_record_id AND user_id = v_user_id;
      ELSE
        UPDATE debt_accounts SET linked_account_id = CASE WHEN p_payload ? 'linked_account_id' THEN NULLIF(p_payload->>'linked_account_id', '')::uuid ELSE linked_account_id END, name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END, lender_name = CASE WHEN p_payload ? 'lender_name' THEN p_payload->>'lender_name' ELSE lender_name END, preset_key = CASE WHEN p_payload ? 'preset_key' THEN p_payload->>'preset_key' ELSE preset_key END, status = CASE WHEN p_payload ? 'status' THEN (p_payload->>'status')::odin_debt_account_status ELSE status END, original_balance_centavos = CASE WHEN p_payload ? 'original_balance_centavos' THEN (p_payload->>'original_balance_centavos')::bigint ELSE original_balance_centavos END, current_balance_centavos = CASE WHEN p_payload ? 'current_balance_centavos' THEN (p_payload->>'current_balance_centavos')::bigint ELSE current_balance_centavos END, annual_interest_rate_bps = CASE WHEN p_payload ? 'annual_interest_rate_bps' THEN (p_payload->>'annual_interest_rate_bps')::integer ELSE annual_interest_rate_bps END, minimum_payment_centavos = CASE WHEN p_payload ? 'minimum_payment_centavos' THEN (p_payload->>'minimum_payment_centavos')::bigint ELSE minimum_payment_centavos END, payment_frequency = CASE WHEN p_payload ? 'payment_frequency' THEN p_payload->>'payment_frequency' ELSE payment_frequency END, next_due_date = CASE WHEN p_payload ? 'next_due_date' THEN NULLIF(p_payload->>'next_due_date', '')::date ELSE next_due_date END, maturity_date = CASE WHEN p_payload ? 'maturity_date' THEN NULLIF(p_payload->>'maturity_date', '')::date ELSE maturity_date END, target_payoff_date = CASE WHEN p_payload ? 'target_payoff_date' THEN NULLIF(p_payload->>'target_payoff_date', '')::date ELSE target_payoff_date END, interest_period = CASE WHEN p_payload ? 'interest_period' THEN p_payload->>'interest_period' ELSE interest_period END, interest_method = CASE WHEN p_payload ? 'interest_method' THEN p_payload->>'interest_method' ELSE interest_method END, preset_data = CASE WHEN p_payload ? 'preset_data' THEN p_payload->'preset_data' ELSE preset_data END, notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END, archived_at = CASE WHEN p_payload->>'status' = 'archived' THEN COALESCE(archived_at, now()) WHEN p_payload ? 'status' THEN NULL ELSE archived_at END, paid_off_at = CASE WHEN p_payload->>'status' = 'paid_off' THEN COALESCE(paid_off_at, now()) WHEN p_payload ? 'status' THEN NULL ELSE paid_off_at END, version = v_version + 1, updated_at = now() WHERE id = p_record_id AND user_id = v_user_id;
      END IF;
      v_version := v_version + 1;
    END IF;
    UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_version) WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'applied'::text, NULL::text, v_version, NULL::text[];
    RETURN;
  END IF;
  IF p_entity <> 'debt_payments' OR p_operation_type NOT IN ('update', 'delete') THEN
    SELECT * INTO v_result FROM apply_debt_sync_operation_hardened(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;

  INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
  ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  SELECT * INTO v_payment FROM debt_payments
   WHERE id = p_record_id AND user_id = v_user_id AND deleted = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'debt payment not found or inaccessible'; END IF;
  IF p_base_version IS NOT NULL AND p_base_version <> v_payment.version THEN
    DELETE FROM applied_operations WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'conflict'::text, 'debt payment version changed'::text, v_payment.version, ARRAY['amount_centavos']::text[];
    RETURN;
  END IF;

  SELECT current_balance_centavos INTO v_balance FROM debt_accounts
   WHERE id = v_payment.debt_account_id AND user_id = v_user_id AND deleted = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'linked debt not found or inaccessible'; END IF;

  IF p_operation_type = 'delete' THEN
    UPDATE debt_payments SET deleted = true, version = version + 1, updated_at = now()
     WHERE id = v_payment.id AND user_id = v_user_id;
    UPDATE debt_accounts SET current_balance_centavos = v_balance + v_payment.amount_centavos,
      status = 'active', paid_off_at = NULL, version = version + 1, updated_at = now()
     WHERE id = v_payment.debt_account_id AND user_id = v_user_id;
  ELSE
    v_amount := (p_payload->>'amount_centavos')::bigint;
    SELECT amount_centavos INTO v_transaction_amount FROM transactions
     WHERE id = NULLIF(p_payload->>'transaction_id', '')::uuid AND user_id = v_user_id
       AND deleted = false AND transaction_type = 'expense';
    IF v_amount IS NULL OR v_amount <= 0 OR v_transaction_amount IS DISTINCT FROM v_amount THEN
      RAISE EXCEPTION 'linked transaction does not match debt payment amount';
    END IF;
    IF v_amount > v_balance + v_payment.amount_centavos THEN
      RAISE EXCEPTION 'payment exceeds current debt balance';
    END IF;
    v_balance := v_balance + v_payment.amount_centavos - v_amount;
    UPDATE debt_payments SET amount_centavos = v_amount, principal_centavos = v_amount,
      interest_centavos = COALESCE((p_payload->>'interest_centavos')::bigint, 0),
      payment_date = (p_payload->>'payment_date')::date, notes = p_payload->>'notes',
      version = version + 1, updated_at = now()
     WHERE id = v_payment.id AND user_id = v_user_id;
    UPDATE debt_accounts SET current_balance_centavos = v_balance,
      status = CASE WHEN v_balance = 0 THEN 'paid_off'::odin_debt_account_status ELSE 'active'::odin_debt_account_status END,
      paid_off_at = CASE WHEN v_balance = 0 THEN COALESCE(paid_off_at, now()) ELSE NULL END,
      version = version + 1, updated_at = now()
     WHERE id = v_payment.debt_account_id AND user_id = v_user_id;
  END IF;

  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_payment.version + 1)
   WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_payment.version + 1, NULL::text[];
END;
$$;

GRANT EXECUTE ON FUNCTION apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
