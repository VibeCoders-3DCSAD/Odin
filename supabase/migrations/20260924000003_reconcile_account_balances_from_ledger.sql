-- Financial-account balances are derived from the posted ledger. Earlier sync
-- handlers persisted normal transactions without applying their account effects.
ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_sync_operation_ledger_core;

CREATE OR REPLACE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_already_applied boolean;
  v_result record;
  v_transaction record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.applied_operations
    WHERE operation_id = p_operation_id AND user_id = v_user_id
  ) INTO v_already_applied;

  SELECT * INTO v_result FROM public.apply_sync_operation_ledger_core(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );

  IF v_already_applied OR v_result.status <> 'applied'
     OR p_entity <> 'transactions' OR p_operation_type <> 'create'
     OR COALESCE(p_payload->>'client_mutation_id', '') LIKE 'debt-payment:%' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;

  SELECT transaction_type::text, amount_centavos, source_account_id, destination_account_id
    INTO v_transaction
    FROM public.transactions
   WHERE id = p_record_id AND user_id = v_user_id AND deleted = false;

  IF v_transaction.transaction_type IN ('expense', 'transfer') AND v_transaction.source_account_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.financial_accounts WHERE id = v_transaction.source_account_id AND user_id = v_user_id AND kind <> 'credit_card' AND deleted = false) THEN
    UPDATE public.financial_accounts
       SET current_balance_centavos = current_balance_centavos - v_transaction.amount_centavos,
           version = version + 1, updated_at = now()
     WHERE id = v_transaction.source_account_id AND user_id = v_user_id AND deleted = false
       AND current_balance_centavos >= v_transaction.amount_centavos;
    IF NOT FOUND THEN RAISE EXCEPTION 'source account has insufficient balance'; END IF;
  END IF;

  IF v_transaction.transaction_type IN ('income', 'transfer') AND v_transaction.destination_account_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.financial_accounts WHERE id = v_transaction.destination_account_id AND user_id = v_user_id AND kind <> 'credit_card' AND deleted = false) THEN
    UPDATE public.financial_accounts
       SET current_balance_centavos = current_balance_centavos + v_transaction.amount_centavos,
           version = version + 1, updated_at = now()
     WHERE id = v_transaction.destination_account_id AND user_id = v_user_id AND deleted = false;
  END IF;

  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

-- Repair existing non-credit-card balances from the authoritative ledger.
UPDATE public.financial_accounts a
   SET current_balance_centavos = a.opening_balance_centavos + COALESCE((
         SELECT SUM(CASE
           WHEN t.transaction_type = 'income' AND t.destination_account_id = a.id THEN t.amount_centavos
           WHEN t.transaction_type = 'expense' AND t.source_account_id = a.id THEN -t.amount_centavos
           WHEN t.transaction_type = 'transfer' AND t.destination_account_id = a.id THEN t.amount_centavos
           WHEN t.transaction_type = 'transfer' AND t.source_account_id = a.id THEN -t.amount_centavos
           ELSE 0
         END)
         FROM public.transactions t
         WHERE t.user_id = a.user_id AND t.deleted = false AND t.status = 'posted'
       ), 0),
       version = version + 1,
       updated_at = now()
 WHERE a.kind <> 'credit_card' AND a.deleted = false;

GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
