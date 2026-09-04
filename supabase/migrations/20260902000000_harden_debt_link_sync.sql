-- Keep debt payment application server-authoritative when the transaction was
-- queued separately, and match pulled priorities by their canonical debt key.
CREATE OR REPLACE FUNCTION apply_debt_sync_operation_hardened(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_transaction_type text;
  v_source_account_id uuid;
  v_subcategory_id uuid;
  v_client_mutation_id text;
   v_amount bigint;
   v_balance_debited boolean;
   v_transaction_operation_applied boolean;
   v_current_version integer;
   v_principal bigint;
   v_interest bigint;
  v_debt_id uuid;
   v_payment_version integer;
   v_payment_amount bigint;
  v_current_balance bigint;
  v_existing_user_id uuid;
  v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity = 'user_debt_priorities' AND p_operation_type = 'update' THEN
    IF cardinality(COALESCE(p_changed_fields, ARRAY[]::text[])) = 0 THEN RAISE EXCEPTION 'priority updates must include changed fields'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':debt-priorities', 0));
    SELECT MAX(version) INTO v_current_version FROM user_debt_priorities WHERE user_id = v_user_id;
    IF p_base_version IS DISTINCT FROM v_current_version THEN
      RETURN QUERY SELECT 'conflict'::text, 'debt priority version changed'::text, v_current_version, ARRAY['priorities']::text[];
      RETURN;
    END IF;
  END IF;

  IF p_entity = 'debt_payments' AND p_operation_type = 'create'
     AND (p_payload->>'principal_centavos') ~ '^[0-9]+$'
     AND (p_payload->>'interest_centavos') ~ '^[0-9]+$' THEN
    v_principal := (p_payload->>'principal_centavos')::bigint;
    v_interest := (p_payload->>'interest_centavos')::bigint;
    IF v_principal + v_interest > (p_payload->>'amount_centavos')::bigint THEN
      RAISE EXCEPTION 'principal and interest cannot exceed payment amount';
    END IF;
  END IF;

  IF p_entity = 'debt_payments' AND p_operation_type = 'create'
     AND NOT EXISTS (SELECT 1 FROM applied_operations WHERE operation_id = p_operation_id) THEN
    IF (p_payload->>'amount_centavos') ~ '^[1-9][0-9]*$' THEN
      v_debt_id := NULLIF(p_payload->>'debt_account_id', '')::uuid;
      SELECT current_balance_centavos INTO v_current_balance
      FROM debt_accounts
      WHERE id = v_debt_id AND user_id = v_user_id AND deleted = false AND status = 'active'
      FOR UPDATE;
      IF FOUND AND (p_payload->>'amount_centavos')::bigint > v_current_balance THEN
        RAISE EXCEPTION 'payment exceeds current debt balance';
      END IF;
    END IF;
  END IF;

  IF p_entity = 'debt_payments' AND p_operation_type = 'update' THEN
    IF p_payload->>'source' <> 'transaction' OR NULLIF(p_payload->>'transaction_id', '') IS NULL THEN
      RAISE EXCEPTION 'debt payment updates must link a transaction';
    END IF;
    INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
    VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
    ON CONFLICT (operation_id) DO NOTHING;
    IF NOT FOUND THEN
      SELECT user_id INTO v_existing_user_id FROM applied_operations WHERE operation_id = p_operation_id;
      IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
        RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
      ELSE
        RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
      END IF;
      RETURN;
    END IF;
    SELECT dp.version, dp.amount_centavos INTO v_payment_version, v_payment_amount
    FROM debt_payments dp
    WHERE dp.id = p_record_id AND dp.user_id = v_user_id AND dp.deleted = false
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'debt payment not found or inaccessible'; END IF;
    IF p_base_version IS NOT NULL AND p_base_version <> v_payment_version THEN
      DELETE FROM applied_operations WHERE operation_id = p_operation_id;
      RETURN QUERY SELECT 'conflict'::text, 'debt payment version changed'::text, v_payment_version, ARRAY['transaction_id']::text[];
      RETURN;
    END IF;
    SELECT t.transaction_type::text, t.amount_centavos, t.source_account_id, t.subcategory_id, t.client_mutation_id
    INTO v_transaction_type, v_amount, v_source_account_id, v_subcategory_id, v_client_mutation_id
    FROM transactions t
    WHERE t.id = NULLIF(p_payload->>'transaction_id', '')::uuid AND t.user_id = v_user_id
      AND t.deleted = false AND t.status = 'posted';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'linked transaction not found';
    END IF;
    IF v_amount IS DISTINCT FROM v_payment_amount THEN
      RAISE EXCEPTION 'linked transaction amount does not match payment amount';
    END IF;
    IF v_transaction_type <> 'expense'
       OR v_client_mutation_id IS DISTINCT FROM 'debt-payment:' || p_record_id::text
       OR v_source_account_id IS DISTINCT FROM NULLIF(p_payload->>'linked_source_account_id', '')::uuid
       OR v_subcategory_id IS DISTINCT FROM NULLIF(p_payload->>'linked_subcategory_id', '')::uuid THEN
       RAISE EXCEPTION 'linked transaction fields do not match transaction';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM applied_operations
      WHERE user_id = v_user_id
        AND entity = 'transactions'
        AND record_id = NULLIF(p_payload->>'transaction_id', '')::uuid
        AND result->>'status' = 'applied'
    ) THEN
      RAISE EXCEPTION 'linked transaction has not been synced';
    END IF;
    UPDATE debt_payments
    SET transaction_id = NULLIF(p_payload->>'transaction_id', '')::uuid,
        source = 'transaction', payment_date = (p_payload->>'payment_date')::date,
        version = v_payment_version + 1, updated_at = now()
    WHERE id = p_record_id AND user_id = v_user_id AND transaction_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'debt payment is already linked'; END IF;
    UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_payment_version + 1) WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'applied'::text, NULL::text, v_payment_version + 1, NULL::text[];
    RETURN;
  END IF;

  IF p_entity = 'debt_payments' AND p_operation_type = 'create' THEN
    SELECT t.transaction_type::text, t.source_account_id, t.subcategory_id,
           t.client_mutation_id
       INTO v_transaction_type, v_source_account_id, v_subcategory_id,
            v_client_mutation_id
    FROM transactions t
    WHERE t.id = NULLIF(p_payload->>'transaction_id', '')::uuid
      AND t.user_id = v_user_id;

    IF FOUND THEN
      IF v_client_mutation_id IS DISTINCT FROM 'debt-payment:' || p_record_id::text THEN
        RAISE EXCEPTION 'transaction was not created by Debt Manager';
      END IF;
      IF v_transaction_type <> COALESCE(p_payload->>'linked_transaction_type', '')
         OR v_source_account_id IS DISTINCT FROM NULLIF(p_payload->>'linked_source_account_id', '')::uuid
         OR v_subcategory_id IS DISTINCT FROM NULLIF(p_payload->>'linked_subcategory_id', '')::uuid THEN
        RAISE EXCEPTION 'linked transaction fields do not match transaction';
      END IF;

      v_amount := (p_payload->>'amount_centavos')::bigint;
       SELECT EXISTS (
         SELECT 1 FROM applied_operations ao
         WHERE ao.user_id = v_user_id AND ao.entity = 'transactions'
           AND ao.record_id = NULLIF(p_payload->>'transaction_id', '')::uuid
           AND ao.result->>'status' = 'applied'
       ) INTO v_transaction_operation_applied;
       v_balance_debited := COALESCE(v_transaction_operation_applied, false);
       IF NOT v_balance_debited THEN
        UPDATE financial_accounts
        SET current_balance_centavos = current_balance_centavos - v_amount,
            version = version + 1, updated_at = now()
        WHERE id = v_source_account_id AND user_id = v_user_id AND deleted = false
          AND current_balance_centavos >= v_amount;
        IF NOT FOUND THEN RAISE EXCEPTION 'source account has insufficient balance'; END IF;
        PERFORM set_config('odin.debt_payment_balance_debited', 'true', true);
        UPDATE transactions
        SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{debt_payment_balance_debited}', 'true'::jsonb),
            version = version + 1, updated_at = now()
        WHERE id = NULLIF(p_payload->>'transaction_id', '')::uuid AND user_id = v_user_id;
       END IF;
       IF v_balance_debited THEN
         PERFORM set_config('odin.debt_payment_balance_debited', 'true', true);
       END IF;
    END IF;
  END IF;

  IF p_entity = 'debt_payments' AND p_operation_type = 'create' THEN
    v_debt_id := NULLIF(p_payload->>'debt_account_id', '')::uuid;
    UPDATE debt_accounts
    SET paid_off_at = COALESCE(paid_off_at, now())
    WHERE id = v_debt_id AND user_id = v_user_id AND status = 'active'
      AND current_balance_centavos = (p_payload->>'amount_centavos')::bigint;
  ELSIF p_entity = 'debt_accounts' AND p_operation_type = 'update' AND p_payload ? 'status' THEN
    UPDATE debt_accounts
    SET paid_off_at = CASE WHEN p_payload->>'status' = 'paid_off' THEN COALESCE(paid_off_at, now()) ELSE NULL END
    WHERE id = p_record_id AND user_id = v_user_id;
  END IF;

  SELECT * INTO v_result FROM apply_debt_sync_operation_v1(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;
