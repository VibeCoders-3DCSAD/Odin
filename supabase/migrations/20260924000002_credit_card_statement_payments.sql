-- This must sort after the debt-account wrapper, which already uses the
-- 20260924000000 version in the linked project.
CREATE OR REPLACE FUNCTION public.apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user uuid := auth.uid();
  v_statement_balance bigint;
  v_result record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity = 'credit_card_payments' AND p_operation_type = 'create' THEN
    SELECT statement_balance_centavos INTO v_statement_balance
      FROM public.credit_card_statements
     WHERE id = NULLIF(p_payload->>'statement_id', '')::uuid
       AND user_id = v_user AND deleted = false AND authoritative = true;
    IF v_statement_balance IS NULL
       OR COALESCE((p_payload->>'amount_centavos')::bigint, 0) <= 0
       OR (p_payload->>'amount_centavos')::bigint > v_statement_balance THEN
      RETURN QUERY SELECT 'rejected'::text, 'credit-card payment exceeds its statement balance'::text, NULL::integer, NULL::text[];
      RETURN;
    END IF;
  END IF;

  SELECT * INTO v_result FROM public.apply_credit_card_sync_operation_v3(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
