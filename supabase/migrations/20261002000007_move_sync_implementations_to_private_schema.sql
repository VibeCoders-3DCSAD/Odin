CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- The debt wrapper resolves its implementation chain at runtime.
ALTER FUNCTION public.apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  SET search_path = public, private, auth;

-- Move every versioned implementation after canonical wrappers have been
-- configured to execute as their owner with private in their search path.
DO $$
DECLARE
  v_function regprocedure;
BEGIN
  FOR v_function IN
    SELECT procedure.oid::regprocedure
      FROM pg_proc AS procedure
      JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
     WHERE namespace.nspname = 'public'
       AND (
         procedure.proname = 'apply_sync_operation_ledger_core'
         OR procedure.proname = 'apply_debt_sync_operation_hardened'
         OR procedure.proname LIKE 'apply_debt_sync_operation_v%'
         OR procedure.proname = 'apply_credit_card_sync_operation_core'
         OR procedure.proname LIKE 'apply_credit_card_sync_operation_v%'
         OR procedure.proname = 'apply_credit_card_repayment_preference_sync_operation_core'
       )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET SCHEMA private', v_function);
  END LOOP;
END;
$$;

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

  IF EXISTS (
    SELECT 1 FROM public.financial_accounts AS account
     WHERE account.user_id = v_user_id AND account.kind <> 'credit_card' AND account.deleted = false
       AND account.opening_balance_centavos + COALESCE((
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
       ), 0) < 0
  ) THEN
    RAISE EXCEPTION 'transaction would overdraw a financial account';
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

CREATE OR REPLACE FUNCTION public.apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_previous_amount bigint;
  v_current_amount bigint;
  v_account_id uuid;
  v_delta bigint;
  v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity = 'credit_card_payments' AND p_operation_type IN ('update', 'delete') THEN
    SELECT payment.amount_centavos, cycle.account_id INTO v_previous_amount, v_account_id
      FROM public.credit_card_payments AS payment
      JOIN public.credit_card_cycles AS cycle ON cycle.id = payment.cycle_id AND cycle.user_id = payment.user_id
     WHERE payment.id = p_record_id AND payment.user_id = v_user_id AND payment.deleted = false
     FOR UPDATE;
  END IF;

  IF p_entity = 'credit_card_repayment_preferences' THEN
    RETURN QUERY SELECT * FROM private.apply_credit_card_repayment_preference_sync_operation_core(
      p_operation_id, p_device_id, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;

  SELECT * INTO v_result FROM private.apply_credit_card_sync_operation_core(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
  IF v_result.status <> 'applied' OR p_entity <> 'credit_card_payments' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;

  IF p_operation_type = 'delete' THEN
    v_delta := -v_previous_amount;
  ELSE
    SELECT payment.amount_centavos, cycle.account_id INTO v_current_amount, v_account_id
      FROM public.credit_card_payments AS payment
      JOIN public.credit_card_cycles AS cycle ON cycle.id = payment.cycle_id AND cycle.user_id = payment.user_id
     WHERE payment.id = p_record_id AND payment.user_id = v_user_id AND payment.deleted = false;
    v_delta := v_current_amount - COALESCE(v_previous_amount, 0);
  END IF;

  IF v_account_id IS NULL OR v_delta IS NULL THEN RAISE EXCEPTION 'credit-card payment card is invalid'; END IF;
  IF v_delta <> 0 THEN
    PERFORM set_config('odin.credit_card_invariant_path', 'true', true);
    UPDATE public.credit_card_details
       SET available_credit_centavos = LEAST(credit_limit_centavos, COALESCE(available_credit_centavos, credit_limit_centavos) + v_delta),
           version = version + 1, updated_at = now()
     WHERE account_id = v_account_id AND user_id = v_user_id AND deleted = false;
    IF NOT FOUND THEN RAISE EXCEPTION 'credit-card details not found'; END IF;
  END IF;

  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
