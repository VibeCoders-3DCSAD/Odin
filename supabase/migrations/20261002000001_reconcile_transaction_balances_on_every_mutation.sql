-- The posted transaction ledger is authoritative. Reconcile after every
-- successful transaction mutation so edits and deletes cannot leave balances stale.
CREATE OR REPLACE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_already_applied boolean;
  v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.applied_operations
     WHERE operation_id = p_operation_id AND user_id = v_user_id
  ) INTO v_already_applied;

  -- Serialize per-user ledger changes before the core mutates a transaction.
  IF p_entity = 'transactions' THEN
    PERFORM 1
      FROM public.financial_accounts
     WHERE user_id = v_user_id AND kind <> 'credit_card' AND deleted = false
     ORDER BY id
     FOR UPDATE;
  END IF;

  SELECT * INTO v_result FROM public.apply_sync_operation_ledger_core(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );

  IF v_already_applied OR v_result.status <> 'applied' OR p_entity <> 'transactions' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;

  -- Reject mutations that would make any non-credit account overdrawn. Raising
  -- rolls back both this reconciliation and the delegated transaction mutation.
  IF EXISTS (
    SELECT 1
      FROM public.financial_accounts AS account
     WHERE account.user_id = v_user_id
       AND account.kind <> 'credit_card'
       AND account.deleted = false
       AND account.opening_balance_centavos + COALESCE((
         SELECT SUM(CASE
           WHEN ledger_transaction.transaction_type = 'income'
             AND ledger_transaction.destination_account_id = account.id THEN ledger_transaction.amount_centavos
           WHEN ledger_transaction.transaction_type = 'expense'
             AND ledger_transaction.source_account_id = account.id THEN -ledger_transaction.amount_centavos
           WHEN ledger_transaction.transaction_type = 'transfer'
             AND ledger_transaction.destination_account_id = account.id THEN ledger_transaction.amount_centavos
           WHEN ledger_transaction.transaction_type = 'transfer'
             AND ledger_transaction.source_account_id = account.id THEN -ledger_transaction.amount_centavos
           ELSE 0
         END)
          FROM public.transactions AS ledger_transaction
          WHERE ledger_transaction.user_id = account.user_id
            AND ledger_transaction.deleted = false
            AND ledger_transaction.status = 'posted'
       ), 0) < 0
  ) THEN
    RAISE EXCEPTION 'transaction would overdraw a financial account';
  END IF;

  WITH reconciled_balances AS (
    SELECT account.id,
           account.opening_balance_centavos + COALESCE((
           SELECT SUM(CASE
             WHEN ledger_transaction.transaction_type = 'income'
               AND ledger_transaction.destination_account_id = account.id THEN ledger_transaction.amount_centavos
             WHEN ledger_transaction.transaction_type = 'expense'
               AND ledger_transaction.source_account_id = account.id THEN -ledger_transaction.amount_centavos
             WHEN ledger_transaction.transaction_type = 'transfer'
               AND ledger_transaction.destination_account_id = account.id THEN ledger_transaction.amount_centavos
             WHEN ledger_transaction.transaction_type = 'transfer'
               AND ledger_transaction.source_account_id = account.id THEN -ledger_transaction.amount_centavos
             ELSE 0
           END)
            FROM public.transactions AS ledger_transaction
            WHERE ledger_transaction.user_id = account.user_id
              AND ledger_transaction.deleted = false
              AND ledger_transaction.status = 'posted'
         ), 0) AS current_balance_centavos
      FROM public.financial_accounts AS account
     WHERE account.user_id = v_user_id
       AND account.kind <> 'credit_card'
       AND account.deleted = false
  )
  UPDATE public.financial_accounts AS account
     SET current_balance_centavos = reconciled_balances.current_balance_centavos,
         version = account.version + 1,
         updated_at = now()
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
