-- A statement payment restores card availability immediately. The card's
-- configured limit remains unchanged; only its derived available credit moves.
DO $$
BEGIN
  PERFORM set_config('odin.credit_card_invariant_path', 'true', true);
  UPDATE public.credit_card_details AS details
     SET available_credit_centavos = LEAST(
           details.credit_limit_centavos,
           COALESCE(details.available_credit_centavos, details.credit_limit_centavos) + COALESCE((
             SELECT SUM(payment.amount_centavos)
               FROM public.credit_card_payments AS payment
               JOIN public.credit_card_cycles AS cycle
                 ON cycle.id = payment.cycle_id AND cycle.user_id = payment.user_id
              WHERE payment.user_id = details.user_id AND cycle.account_id = details.account_id
                AND payment.deleted = false AND payment.issuer_recognized = false
           ), 0)
         ),
         version = version + 1,
         updated_at = now()
   WHERE details.deleted = false
     AND EXISTS (
       SELECT 1 FROM public.financial_accounts AS account
        WHERE account.id = details.account_id AND account.user_id = details.user_id
          AND account.kind = 'credit_card' AND account.deleted = false
     );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_previous_amount bigint;
  v_current_amount bigint;
  v_account_id uuid;
  v_result record;
  v_delta bigint;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity <> 'credit_card_payments' OR p_operation_type NOT IN ('create', 'update', 'delete') THEN
    RETURN QUERY SELECT * FROM public.apply_credit_card_sync_operation_v3(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;

  IF p_operation_type IN ('update', 'delete') THEN
    SELECT payment.amount_centavos, cycle.account_id
      INTO v_previous_amount, v_account_id
      FROM public.credit_card_payments AS payment
      JOIN public.credit_card_cycles AS cycle
        ON cycle.id = payment.cycle_id AND cycle.user_id = payment.user_id
     WHERE payment.id = p_record_id AND payment.user_id = v_user_id AND payment.deleted = false
     FOR UPDATE;
  END IF;

  SELECT * INTO v_result FROM public.apply_credit_card_sync_operation_v3(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
  IF v_result.status <> 'applied' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;

  IF p_operation_type = 'delete' THEN
    v_delta := -v_previous_amount;
  ELSE
    SELECT payment.amount_centavos, cycle.account_id
      INTO v_current_amount, v_account_id
      FROM public.credit_card_payments AS payment
      JOIN public.credit_card_cycles AS cycle
        ON cycle.id = payment.cycle_id AND cycle.user_id = payment.user_id
     WHERE payment.id = p_record_id AND payment.user_id = v_user_id AND payment.deleted = false;
    v_delta := v_current_amount - COALESCE(v_previous_amount, 0);
  END IF;

  IF v_account_id IS NULL OR v_delta IS NULL THEN
    RAISE EXCEPTION 'credit-card payment card is invalid';
  END IF;

  IF v_delta <> 0 THEN
    PERFORM set_config('odin.credit_card_invariant_path', 'true', true);
    UPDATE public.credit_card_details
       SET available_credit_centavos = LEAST(
             credit_limit_centavos,
             COALESCE(available_credit_centavos, credit_limit_centavos) + v_delta
           ),
           version = version + 1,
           updated_at = now()
     WHERE account_id = v_account_id AND user_id = v_user_id AND deleted = false;
    IF NOT FOUND THEN RAISE EXCEPTION 'credit-card details not found'; END IF;
  END IF;

  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
