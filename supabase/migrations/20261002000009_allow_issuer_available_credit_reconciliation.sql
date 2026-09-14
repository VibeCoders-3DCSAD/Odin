-- An issuer-reported available-credit reconciliation is authoritative. Keep
-- this narrow path separate from derived purchase and payment updates.
CREATE OR REPLACE FUNCTION public.apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_version integer;
  v_available_credit bigint;
  v_credit_limit bigint;
  v_current_credit_limit bigint;
  v_current_available_credit bigint;
  v_existing_user uuid;
  v_previous_amount bigint;
  v_current_amount bigint;
  v_account_id uuid;
  v_delta bigint;
  v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN RAISE EXCEPTION 'invalid device id'; END IF;

  IF p_entity = 'credit_card_details'
     AND p_operation_type = 'update'
     AND p_changed_fields <@ ARRAY['available_credit_centavos', 'credit_limit_centavos']
     AND 'available_credit_centavos' = ANY(p_changed_fields)
     AND p_payload ? 'available_credit_centavos'
     AND jsonb_object_length(p_payload) = cardinality(p_changed_fields) THEN
    IF p_payload->>'available_credit_centavos' !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'available_credit_centavos must be non-negative';
    END IF;
    v_available_credit := (p_payload->>'available_credit_centavos')::bigint;
    IF p_payload ? 'credit_limit_centavos' THEN
      IF p_payload->>'credit_limit_centavos' !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'credit_limit_centavos must be positive'; END IF;
      v_credit_limit := (p_payload->>'credit_limit_centavos')::bigint;
    END IF;
    INSERT INTO public.applied_operations(operation_id, user_id, device_id, entity, record_id, operation_type, result)
    VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
    ON CONFLICT (operation_id) DO NOTHING;
    IF NOT FOUND THEN
      SELECT user_id INTO v_existing_user FROM public.applied_operations WHERE operation_id = p_operation_id;
      IF v_existing_user IS DISTINCT FROM v_user_id THEN
        RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
      ELSE
        RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
      END IF;
      RETURN;
    END IF;

    SELECT version, credit_limit_centavos, available_credit_centavos
      INTO v_version, v_current_credit_limit, v_current_available_credit
      FROM public.credit_card_details
      WHERE account_id = p_record_id AND user_id = v_user_id AND deleted = false
      FOR UPDATE;
    IF v_version IS NULL THEN RAISE EXCEPTION 'credit-card details not found or inaccessible'; END IF;
    IF v_credit_limit IS NOT NULL
       AND v_credit_limit < v_available_credit + GREATEST(0, v_current_credit_limit - COALESCE(v_current_available_credit, v_current_credit_limit)) THEN
      RAISE EXCEPTION 'credit limit is less than the reconciled available credit plus remaining debt; align the credit limit or edit debt records';
    END IF;
    IF p_base_version IS NULL OR p_base_version <> v_version THEN
      UPDATE public.applied_operations
        SET result = jsonb_build_object('status', 'conflict', 'current_version', v_version, 'conflicted_fields', to_jsonb(p_changed_fields))
        WHERE operation_id = p_operation_id;
      RETURN QUERY SELECT 'conflict'::text, 'credit-card version changed'::text, v_version, p_changed_fields;
      RETURN;
    END IF;

    UPDATE public.credit_card_details
       SET available_credit_centavos = v_available_credit,
           credit_limit_centavos = COALESCE(v_credit_limit, credit_limit_centavos),
           version = version + 1, updated_at = now()
      WHERE account_id = p_record_id AND user_id = v_user_id AND deleted = false;
    UPDATE public.applied_operations
      SET result = jsonb_build_object('status', 'applied', 'current_version', v_version + 1)
      WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'applied'::text, NULL::text, v_version + 1, NULL::text[];
    RETURN;
  END IF;

  IF p_entity = 'credit_card_payments' AND p_operation_type IN ('update', 'delete') THEN
    SELECT payment.amount_centavos, cycle.account_id INTO v_previous_amount, v_account_id
      FROM public.credit_card_payments AS payment
      JOIN public.credit_card_cycles AS cycle ON cycle.id = payment.cycle_id AND cycle.user_id = payment.user_id
      WHERE payment.id = p_record_id AND payment.user_id = v_user_id AND payment.deleted = false
      FOR UPDATE;
  END IF;

  IF p_entity = 'credit_card_repayment_preferences' THEN
    RETURN QUERY SELECT * FROM private.apply_credit_card_repayment_preference_sync_operation_core(
      p_operation_id, p_device_id, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;

  SELECT * INTO v_result FROM private.apply_credit_card_sync_operation_core(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
  IF v_result.status <> 'applied' OR p_entity <> 'credit_card_payments' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;

  IF p_operation_type = 'delete' THEN
    v_delta := -v_previous_amount;
  ELSE
    SELECT payment.amount_centavos, cycle.account_id INTO v_current_amount, v_account_id
      FROM public.credit_card_payments AS payment
      JOIN public.credit_card_cycles AS cycle ON cycle.id = payment.cycle_id AND cycle.user_id = payment.user_id
      WHERE payment.id = p_record_id AND payment.user_id = v_user_id AND payment.deleted = false;
    v_delta := v_current_amount - COALESCE(v_previous_amount, 0);
  END IF;
  IF v_account_id IS NULL OR v_delta IS NULL THEN RAISE EXCEPTION 'credit-card payment card is invalid'; END IF;
  IF v_delta <> 0 THEN
    PERFORM set_config('odin.credit_card_invariant_path', 'true', true);
    UPDATE public.credit_card_details
      SET available_credit_centavos = LEAST(credit_limit_centavos, COALESCE(available_credit_centavos, credit_limit_centavos) + v_delta), version = version + 1, updated_at = now()
      WHERE account_id = v_account_id AND user_id = v_user_id AND deleted = false;
    IF NOT FOUND THEN RAISE EXCEPTION 'credit-card details not found'; END IF;
  END IF;
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
