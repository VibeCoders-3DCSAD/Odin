-- The app warns before allowing an overdraft. Rejecting a new transaction
-- because any unrelated historical account is negative prevents sync recovery.
CREATE OR REPLACE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_already_applied boolean;
  v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.applied_operations
     WHERE operation_id = p_operation_id AND user_id = v_user_id
  ) INTO v_already_applied;

  IF p_entity = 'transactions' THEN
    PERFORM 1 FROM public.financial_accounts
     WHERE user_id = v_user_id AND kind <> 'credit_card' AND deleted = false
     ORDER BY id FOR UPDATE;
  END IF;

  SELECT * INTO v_result FROM private.apply_sync_operation_ledger_core(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );

  IF v_already_applied OR v_result.status <> 'applied' OR p_entity <> 'transactions' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;

  WITH reconciled_balances AS (
    SELECT account.id, account.opening_balance_centavos + COALESCE((
      SELECT SUM(CASE
        WHEN transaction_row.transaction_type = 'income' AND transaction_row.destination_account_id = account.id THEN transaction_row.amount_centavos
        WHEN transaction_row.transaction_type = 'expense' AND transaction_row.source_account_id = account.id THEN -transaction_row.amount_centavos
        WHEN transaction_row.transaction_type = 'transfer' AND transaction_row.destination_account_id = account.id THEN transaction_row.amount_centavos
        WHEN transaction_row.transaction_type = 'transfer' AND transaction_row.source_account_id = account.id THEN -transaction_row.amount_centavos
        ELSE 0
      END)
      FROM public.transactions AS transaction_row
      WHERE transaction_row.user_id = account.user_id
        AND transaction_row.deleted = false AND transaction_row.status = 'posted'
    ), 0) AS current_balance_centavos
    FROM public.financial_accounts AS account
    WHERE account.user_id = v_user_id AND account.kind <> 'credit_card' AND account.deleted = false
  )
  UPDATE public.financial_accounts AS account
     SET current_balance_centavos = reconciled_balances.current_balance_centavos,
         version = account.version + 1, updated_at = now()
    FROM reconciled_balances
   WHERE account.id = reconciled_balances.id
     AND account.current_balance_centavos IS DISTINCT FROM reconciled_balances.current_balance_centavos;

  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  TO authenticated;
