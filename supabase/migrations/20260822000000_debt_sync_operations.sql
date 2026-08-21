CREATE OR REPLACE FUNCTION apply_budget_sync_operation_v2(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_result record;
BEGIN
  SELECT * INTO v_result FROM apply_budget_sync_operation(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
  IF v_result.status = 'applied' AND p_operation_type IN ('create', 'update') THEN
    UPDATE budgets
    SET debt_budget_amount_centavos = COALESCE((p_payload->>'debt_budget_amount_minor')::bigint, 0),
        updated_at = now()
    WHERE id = p_record_id AND user_id = auth.uid();
  END IF;
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

CREATE OR REPLACE FUNCTION apply_debt_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_version integer;
  v_deleted boolean;
  v_item jsonb;
  v_rank integer := 0;
  v_debt_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity NOT IN ('debt_accounts', 'debt_payments', 'user_debt_priorities', 'debt_strategy_preferences') THEN
    RAISE EXCEPTION 'entity % is not a debt entity', p_entity;
  END IF;
  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'unsupported operation'; END IF;

  INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
  ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  IF p_entity = 'debt_accounts' THEN
    IF p_operation_type = 'create' THEN
      INSERT INTO debt_accounts (
        id, user_id, name, lender_name, preset_key, original_balance_centavos,
        current_balance_centavos, annual_interest_rate_bps, minimum_payment_centavos,
        payment_frequency, next_due_date, maturity_date, target_payoff_date,
        interest_period, interest_method, preset_data, notes, version, deleted, updated_at
      ) VALUES (
        p_record_id, v_user_id, p_payload->>'name', p_payload->>'lender_name',
        COALESCE(p_payload->>'preset_key', 'unknown'),
        COALESCE((p_payload->>'original_balance_centavos')::bigint, 0),
        COALESCE((p_payload->>'current_balance_centavos')::bigint, 0),
        COALESCE((p_payload->>'annual_interest_rate_bps')::integer, 0),
        COALESCE((p_payload->>'minimum_payment_centavos')::bigint, 0),
        COALESCE(p_payload->>'payment_frequency', 'monthly'),
        NULLIF(p_payload->>'next_due_date', '')::date,
        NULLIF(p_payload->>'maturity_date', '')::date,
        NULLIF(p_payload->>'target_payoff_date', '')::date,
        p_payload->>'interest_period', p_payload->>'interest_method',
        COALESCE(p_payload->'preset_data', '{}'::jsonb), p_payload->>'notes', 1, false, now()
      );
    ELSE
      SELECT version, deleted INTO v_version, v_deleted FROM debt_accounts
      WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
      IF v_version IS NULL OR v_deleted THEN RAISE EXCEPTION 'debt not found or inaccessible'; END IF;
      IF p_base_version IS NOT NULL AND p_base_version <> v_version THEN
        RETURN QUERY SELECT 'conflict'::text, 'debt version changed'::text, v_version, p_changed_fields;
        RETURN;
      END IF;
      IF p_operation_type = 'delete' THEN
        UPDATE debt_accounts SET status = 'deleted', deleted = true, deleted_at = now(), version = v_version + 1, updated_at = now()
        WHERE id = p_record_id AND user_id = v_user_id;
      ELSE
        UPDATE debt_accounts SET
          name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
          lender_name = CASE WHEN p_payload ? 'lender_name' THEN p_payload->>'lender_name' ELSE lender_name END,
          preset_key = CASE WHEN p_payload ? 'preset_key' THEN p_payload->>'preset_key' ELSE preset_key END,
          status = CASE WHEN p_payload ? 'status' THEN (p_payload->>'status')::odin_debt_account_status ELSE status END,
          paid_off_at = CASE WHEN p_payload->>'status' = 'paid_off' AND status <> 'paid_off' THEN now() ELSE paid_off_at END,
          original_balance_centavos = CASE WHEN p_payload ? 'original_balance_centavos' THEN (p_payload->>'original_balance_centavos')::bigint ELSE original_balance_centavos END,
          current_balance_centavos = CASE WHEN p_payload ? 'current_balance_centavos' THEN (p_payload->>'current_balance_centavos')::bigint ELSE current_balance_centavos END,
          annual_interest_rate_bps = CASE WHEN p_payload ? 'annual_interest_rate_bps' THEN (p_payload->>'annual_interest_rate_bps')::integer ELSE annual_interest_rate_bps END,
          minimum_payment_centavos = CASE WHEN p_payload ? 'minimum_payment_centavos' THEN (p_payload->>'minimum_payment_centavos')::bigint ELSE minimum_payment_centavos END,
          payment_frequency = CASE WHEN p_payload ? 'payment_frequency' THEN p_payload->>'payment_frequency' ELSE payment_frequency END,
          next_due_date = CASE WHEN p_payload ? 'next_due_date' THEN NULLIF(p_payload->>'next_due_date', '')::date ELSE next_due_date END,
          maturity_date = CASE WHEN p_payload ? 'maturity_date' THEN NULLIF(p_payload->>'maturity_date', '')::date ELSE maturity_date END,
          target_payoff_date = CASE WHEN p_payload ? 'target_payoff_date' THEN NULLIF(p_payload->>'target_payoff_date', '')::date ELSE target_payoff_date END,
          interest_period = CASE WHEN p_payload ? 'interest_period' THEN p_payload->>'interest_period' ELSE interest_period END,
          interest_method = CASE WHEN p_payload ? 'interest_method' THEN p_payload->>'interest_method' ELSE interest_method END,
          preset_data = CASE WHEN p_payload ? 'preset_data' THEN p_payload->'preset_data' ELSE preset_data END,
          notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END,
          version = v_version + 1, updated_at = now()
        WHERE id = p_record_id AND user_id = v_user_id;
      END IF;
    END IF;
  ELSIF p_entity = 'debt_payments' AND p_operation_type = 'create' THEN
    v_debt_id := (p_payload->>'debt_account_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM debt_accounts WHERE id = v_debt_id AND user_id = v_user_id AND deleted = false) THEN
      RAISE EXCEPTION 'debt_account_id does not reference an accessible debt';
    END IF;
    IF NULLIF(p_payload->>'transaction_id', '') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM transactions
      WHERE id = (p_payload->>'transaction_id')::uuid AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'transaction_id does not reference an accessible transaction';
    END IF;
    INSERT INTO debt_payments (id, debt_account_id, user_id, transaction_id, source, payment_date, amount_centavos, principal_centavos, interest_centavos, notes, version, deleted, updated_at)
    VALUES (p_record_id, v_debt_id, v_user_id, NULLIF(p_payload->>'transaction_id', '')::uuid, COALESCE(p_payload->>'source', 'transaction'), (p_payload->>'payment_date')::date, (p_payload->>'amount_centavos')::bigint, NULLIF(p_payload->>'principal_centavos', '')::bigint, NULLIF(p_payload->>'interest_centavos', '')::bigint, p_payload->>'notes', 1, false, now());
  ELSIF p_entity = 'user_debt_priorities' THEN
    IF jsonb_array_length(COALESCE(p_payload->'priorities', '[]'::jsonb)) <> (
      SELECT count(DISTINCT value) FROM jsonb_array_elements_text(COALESCE(p_payload->'priorities', '[]'::jsonb)) AS items(value)
    ) THEN
      RAISE EXCEPTION 'priority list contains duplicate debts';
    END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'priorities', '[]'::jsonb)) LOOP
      v_debt_id := (v_item #>> '{}')::uuid;
      IF NOT EXISTS (SELECT 1 FROM debt_accounts WHERE id = v_debt_id AND user_id = v_user_id AND deleted = false) THEN
        RAISE EXCEPTION 'priority references an inaccessible debt';
      END IF;
    END LOOP;
    DELETE FROM user_debt_priorities WHERE user_id = v_user_id;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'priorities', '[]'::jsonb)) LOOP
      v_rank := v_rank + 1;
      INSERT INTO user_debt_priorities (id, user_id, debt_account_id, priority_rank, version, deleted, updated_at)
      VALUES (gen_random_uuid(), v_user_id, (v_item #>> '{}')::uuid, v_rank, 1, false, now());
    END LOOP;
  ELSIF p_entity = 'debt_strategy_preferences' THEN
    INSERT INTO debt_strategy_preferences (user_id, strategy, version, deleted, updated_at)
    VALUES (v_user_id, (p_payload->>'strategy')::odin_debt_strategy, 1, false, now())
    ON CONFLICT (user_id) DO UPDATE SET strategy = excluded.strategy, version = debt_strategy_preferences.version + 1, deleted = false, updated_at = now();
  END IF;

  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', COALESCE(v_version + 1, 1)) WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, COALESCE(v_version + 1, 1), NULL::text[];
END;
$$;

GRANT EXECUTE ON FUNCTION apply_budget_sync_operation_v2(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
