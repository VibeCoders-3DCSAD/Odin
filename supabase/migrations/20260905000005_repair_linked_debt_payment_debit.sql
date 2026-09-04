-- An applied transaction operation is not itself proof that its account balance
-- was debited. Make the marker server-authoritative before the debt RPC reaches
-- the legacy invariant check.
ALTER FUNCTION apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_debt_sync_operation_v2;

CREATE OR REPLACE FUNCTION apply_debt_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_transaction_id uuid;
  v_source_account_id uuid;
  v_amount bigint;
  v_debited boolean;
  v_transaction_applied boolean;
BEGIN
  IF p_entity = 'debt_payments' AND p_operation_type = 'create'
     AND p_payload->>'source' = 'transaction' THEN
    v_transaction_id := NULLIF(p_payload->>'transaction_id', '')::uuid;

    SELECT t.source_account_id, t.amount_centavos,
           COALESCE((t.metadata->>'debt_payment_balance_debited')::boolean, false)
    INTO v_source_account_id, v_amount, v_debited
    FROM transactions t
    WHERE t.id = v_transaction_id AND t.user_id = v_user_id
      AND t.deleted = false AND t.status = 'posted';

    IF FOUND THEN
      SELECT EXISTS (
        SELECT 1 FROM applied_operations ao
        WHERE ao.user_id = v_user_id AND ao.entity = 'transactions'
          AND ao.record_id = v_transaction_id AND ao.result->>'status' = 'applied'
      ) INTO v_transaction_applied;

      IF NOT (v_transaction_applied AND v_debited) THEN
        UPDATE financial_accounts
        SET current_balance_centavos = current_balance_centavos - v_amount,
            version = version + 1, updated_at = now()
        WHERE id = v_source_account_id AND user_id = v_user_id AND deleted = false
          AND current_balance_centavos >= v_amount;
        IF NOT FOUND THEN RAISE EXCEPTION 'source account has insufficient balance'; END IF;

        UPDATE transactions
        SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{debt_payment_balance_debited}', 'true'::jsonb),
            version = version + 1, updated_at = now()
        WHERE id = v_transaction_id AND user_id = v_user_id;
      END IF;

      PERFORM set_config('odin.debt_payment_balance_debited', 'true', true);
    END IF;
  END IF;

  RETURN QUERY SELECT * FROM apply_debt_sync_operation_v2(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
END;
$$;

GRANT EXECUTE ON FUNCTION apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
