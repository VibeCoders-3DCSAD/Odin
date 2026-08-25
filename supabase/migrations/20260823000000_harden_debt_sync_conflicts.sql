ALTER FUNCTION apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_debt_sync_operation_v1;

CREATE OR REPLACE FUNCTION apply_debt_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_version integer;
  v_amount bigint;
  v_principal bigint;
  v_interest bigint;
  v_item jsonb;
  v_debt_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity = 'user_debt_priorities' AND p_operation_type = 'update' THEN
    IF cardinality(COALESCE(p_changed_fields, ARRAY[]::text[])) = 0 THEN
      RAISE EXCEPTION 'priority updates must include changed fields';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':debt-priorities', 0));
    SELECT MAX(version) INTO v_current_version
    FROM user_debt_priorities
    WHERE user_id = v_user_id;

    IF p_base_version IS DISTINCT FROM v_current_version THEN
      RETURN QUERY SELECT 'conflict'::text, 'debt priority version changed'::text, v_current_version, ARRAY['priorities']::text[];
      RETURN;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'priorities', '[]'::jsonb)) LOOP
      v_debt_id := (v_item #>> '{}')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM debt_accounts
        WHERE id = v_debt_id AND user_id = v_user_id AND deleted = false AND status = 'active'
      ) THEN
        RAISE EXCEPTION 'priority references an inactive or inaccessible debt';
      END IF;
    END LOOP;
  END IF;

  IF p_entity = 'debt_payments' AND p_operation_type = 'create' THEN
    IF (p_payload->>'principal_centavos') ~ '^[0-9]+$' AND (p_payload->>'interest_centavos') ~ '^[0-9]+$' THEN
      v_amount := (p_payload->>'amount_centavos')::bigint;
      v_principal := (p_payload->>'principal_centavos')::bigint;
      v_interest := (p_payload->>'interest_centavos')::bigint;
      IF v_principal + v_interest > v_amount THEN
        RAISE EXCEPTION 'principal and interest cannot exceed payment amount';
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT * FROM apply_debt_sync_operation_v1(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
END;
$$;
