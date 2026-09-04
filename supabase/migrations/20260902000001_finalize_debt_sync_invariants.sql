ALTER TABLE debt_accounts
  DROP CONSTRAINT IF EXISTS debt_accounts_paid_off_balance_chk;

ALTER TABLE debt_accounts
  ADD CONSTRAINT debt_accounts_paid_off_balance_chk
  CHECK (status <> 'paid_off' OR current_balance_centavos = 0) NOT VALID;

CREATE OR REPLACE FUNCTION apply_debt_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_user_id uuid;
  v_current_version integer;
  v_current_balance bigint;
  v_result record;
BEGIN
  IF p_entity = 'debt_accounts' AND p_operation_type = 'create' THEN
    SELECT user_id INTO v_existing_user_id FROM debt_accounts WHERE id = p_record_id;
    IF FOUND THEN
      IF v_existing_user_id = v_user_id THEN
        RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
      ELSE
        RETURN QUERY SELECT 'rejected'::text, 'debt record belongs to another user'::text, NULL::integer, NULL::text[];
      END IF;
      RETURN;
    END IF;
    IF p_payload->>'status' = 'paid_off' AND COALESCE((p_payload->>'current_balance_centavos')::bigint, 0) <> 0 THEN
      RAISE EXCEPTION 'paid_off status requires a zero balance';
    END IF;
  END IF;

  IF p_entity = 'debt_accounts' AND p_operation_type = 'update' AND p_payload->>'status' = 'paid_off' THEN
    SELECT current_balance_centavos INTO v_current_balance
    FROM debt_accounts WHERE id = p_record_id AND user_id = v_user_id AND deleted = false;
    IF v_current_balance IS NULL OR v_current_balance <> 0 THEN
      RAISE EXCEPTION 'paid_off status requires a zero balance';
    END IF;
  END IF;

  IF p_entity = 'debt_strategy_preferences' AND p_operation_type = 'update' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':debt-strategy', 0));
    SELECT version INTO v_current_version FROM debt_strategy_preferences WHERE user_id = v_user_id AND deleted = false;
    IF p_base_version IS DISTINCT FROM v_current_version THEN
      RETURN QUERY SELECT 'conflict'::text, 'debt strategy version changed'::text, v_current_version, ARRAY['strategy']::text[];
      RETURN;
    END IF;
  END IF;

  SELECT * INTO v_result FROM apply_debt_sync_operation_hardened(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );

  IF p_entity = 'debt_accounts' AND p_operation_type IN ('create', 'update') AND v_result.status = 'applied' THEN
    UPDATE debt_accounts
    SET archived_at = CASE
          WHEN p_payload->>'status' = 'archived' THEN COALESCE(archived_at, now())
          WHEN p_payload ? 'status' THEN NULL
          ELSE archived_at
        END,
        paid_off_at = CASE
          WHEN p_payload->>'status' = 'paid_off' THEN COALESCE(paid_off_at, now())
          WHEN p_payload ? 'status' THEN NULL
          ELSE paid_off_at
        END
    WHERE id = p_record_id AND user_id = v_user_id;
  END IF;

  RETURN QUERY SELECT v_result.status, v_result.reason,
    CASE WHEN p_entity = 'debt_strategy_preferences' AND v_result.status = 'applied'
      THEN COALESCE(v_current_version, 0) + 1 ELSE v_result.current_version END,
    v_result.conflicted_fields;
END;
$$;
