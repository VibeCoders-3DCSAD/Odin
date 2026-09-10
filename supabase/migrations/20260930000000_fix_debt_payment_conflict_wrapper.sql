-- Replace the first convergence wrapper without changing its deployed history.
-- Qualifying debt-account columns avoids collision with the function's output
-- column names, and related transaction divergence is a sync conflict.
CREATE OR REPLACE FUNCTION apply_debt_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_payment debt_payments%ROWTYPE;
  v_debt_version integer;
  v_debt_active boolean;
  v_existing_user_id uuid;
  v_transaction_amount bigint;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity = 'debt_payments' AND p_operation_type = 'delete' THEN
    SELECT * INTO v_payment FROM debt_payments
     WHERE id = p_record_id AND user_id = v_user_id AND deleted = false;
    IF NOT FOUND THEN
      INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
      VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type,
        jsonb_build_object('status', 'applied'))
      ON CONFLICT (operation_id) DO NOTHING;
      IF NOT FOUND THEN
        SELECT user_id INTO v_existing_user_id FROM applied_operations WHERE operation_id = p_operation_id;
        IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
          RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
        ELSE
          RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
        END IF;
      ELSE
        RETURN QUERY SELECT 'applied'::text, NULL::text, NULL::integer, NULL::text[];
      END IF;
      RETURN;
    END IF;
  END IF;

  IF p_entity = 'debt_payments' AND p_operation_type = 'create' THEN
    SELECT da.version, da.status = 'active' AND da.deleted = false
      INTO v_debt_version, v_debt_active
      FROM debt_accounts AS da
     WHERE da.id = NULLIF(p_payload->>'debt_account_id', '')::uuid
       AND da.user_id = v_user_id;
    IF NOT FOUND OR NOT v_debt_active THEN
      RETURN QUERY SELECT 'conflict'::text, 'debt account is no longer active'::text,
        v_debt_version, ARRAY['debt_account_id']::text[];
      RETURN;
    END IF;

    RETURN QUERY SELECT * FROM apply_debt_sync_operation_hardened(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;

  IF p_entity = 'debt_payments' AND p_operation_type = 'update' THEN
    SELECT * INTO v_payment FROM debt_payments
     WHERE id = p_record_id AND user_id = v_user_id AND deleted = false;
    IF FOUND THEN
      p_payload := jsonb_build_object(
        'transaction_id', v_payment.transaction_id,
        'amount_centavos', v_payment.amount_centavos,
        'payment_date', v_payment.payment_date,
        'interest_centavos', v_payment.interest_centavos,
        'notes', v_payment.notes
      ) || p_payload;

      SELECT t.amount_centavos INTO v_transaction_amount FROM transactions AS t
       WHERE t.id = v_payment.transaction_id AND t.user_id = v_user_id
         AND t.deleted = false AND t.transaction_type = 'expense';
      IF NOT FOUND OR v_transaction_amount IS DISTINCT FROM (p_payload->>'amount_centavos')::bigint THEN
        RETURN QUERY SELECT 'conflict'::text, 'linked transaction amount changed'::text,
          v_payment.version, ARRAY['amount_centavos']::text[];
        RETURN;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT * FROM apply_debt_sync_operation_v5(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
END;
$$;

GRANT EXECUTE ON FUNCTION apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
