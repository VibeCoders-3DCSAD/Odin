-- The delegated purchase creation operation decrements available credit.
CREATE OR REPLACE FUNCTION apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user uuid := auth.uid();
  v_account uuid;
  v_amount bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity = 'credit_card_transactions'
     AND p_operation_type = 'create'
     AND NOT EXISTS (SELECT 1 FROM applied_operations WHERE operation_id = p_operation_id) THEN
    PERFORM set_config('odin.credit_card_invariant_path', 'true', true);
  END IF;

  IF p_entity = 'credit_card_transactions'
     AND p_operation_type = 'delete'
     AND NOT EXISTS (SELECT 1 FROM applied_operations WHERE operation_id = p_operation_id) THEN
    SELECT cct.account_id, t.amount_centavos
      INTO v_account, v_amount
      FROM credit_card_transactions cct
      JOIN transactions t ON t.id = cct.transaction_id AND t.user_id = cct.user_id
     WHERE cct.transaction_id = p_record_id
       AND cct.user_id = v_user
       AND cct.deleted = false;

    IF v_account IS NOT NULL THEN
      PERFORM set_config('odin.credit_card_invariant_path', 'true', true);
      UPDATE credit_card_details
         SET available_credit_centavos = LEAST(
               credit_limit_centavos,
               COALESCE(available_credit_centavos, credit_limit_centavos) + v_amount
             ),
             version = version + 1,
             updated_at = now()
       WHERE account_id = v_account AND user_id = v_user AND deleted = false;
    END IF;
  END IF;

  RETURN QUERY SELECT * FROM apply_credit_card_sync_operation_v3(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
END; $$;

GRANT EXECUTE ON FUNCTION apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
