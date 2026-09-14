ALTER TABLE public.credit_card_details
  ADD COLUMN IF NOT EXISTS reconciled_available_credit_centavos bigint,
  ADD COLUMN IF NOT EXISTS pre_reconciliation_available_credit_centavos bigint,
  ADD COLUMN IF NOT EXISTS available_credit_reconciled_at timestamptz;
ALTER TABLE public.credit_card_transactions
  ADD COLUMN IF NOT EXISTS forecast_recorded_at timestamptz;
ALTER TABLE public.credit_card_payments
  ADD COLUMN IF NOT EXISTS forecast_recorded_at timestamptz;

-- The account guard intentionally rejects updates to historical rows whose card
-- was later deleted. Those rows are not forecastable, so backfill only active
-- card relationships rather than weakening the guard.
UPDATE public.credit_card_transactions AS card_transaction
   SET forecast_recorded_at = card_transaction.created_at
  FROM public.financial_accounts AS account
 WHERE card_transaction.forecast_recorded_at IS NULL
   AND card_transaction.deleted = false
   AND account.id = card_transaction.account_id
   AND account.user_id = card_transaction.user_id
   AND account.kind = 'credit_card'
   AND account.deleted = false;

UPDATE public.credit_card_payments AS payment
   SET forecast_recorded_at = payment.created_at
  FROM public.credit_card_cycles AS cycle
  JOIN public.financial_accounts AS account
    ON account.id = cycle.account_id
   AND account.user_id = cycle.user_id
 WHERE payment.forecast_recorded_at IS NULL
   AND payment.deleted = false
   AND cycle.id = payment.cycle_id
   AND cycle.user_id = payment.user_id
   AND cycle.deleted = false
   AND account.kind = 'credit_card'
   AND account.deleted = false;

CREATE OR REPLACE FUNCTION public.apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_version integer;
  v_existing_user uuid;
  v_current_credit_limit bigint;
  v_reconciled_available bigint;
  v_pre_reconciliation_available bigint;
  v_reconciled_at timestamptz;
  v_previous_amount bigint;
  v_current_amount bigint;
  v_account_id uuid;
  v_delta bigint;
  v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN RAISE EXCEPTION 'invalid device id'; END IF;

  IF p_entity = 'credit_card_details' AND p_operation_type = 'update'
     AND p_changed_fields <@ ARRAY['available_credit_centavos', 'reconciled_available_credit_centavos', 'pre_reconciliation_available_credit_centavos', 'available_credit_reconciled_at']
     AND ARRAY['available_credit_centavos', 'reconciled_available_credit_centavos', 'pre_reconciliation_available_credit_centavos', 'available_credit_reconciled_at'] <@ p_changed_fields
     AND cardinality(p_changed_fields) = 4
     AND p_payload ?& ARRAY['available_credit_centavos', 'reconciled_available_credit_centavos', 'pre_reconciliation_available_credit_centavos', 'available_credit_reconciled_at']
     AND p_payload - ARRAY['available_credit_centavos', 'reconciled_available_credit_centavos', 'pre_reconciliation_available_credit_centavos', 'available_credit_reconciled_at'] = '{}'::jsonb THEN
    IF p_payload->>'available_credit_centavos' !~ '^[0-9]+$' OR p_payload->>'reconciled_available_credit_centavos' !~ '^[0-9]+$' OR p_payload->>'pre_reconciliation_available_credit_centavos' !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'reconciliation credit values must be non-negative';
    END IF;
    BEGIN v_reconciled_at := (p_payload->>'available_credit_reconciled_at')::timestamptz; EXCEPTION WHEN others THEN RAISE EXCEPTION 'available_credit_reconciled_at must be an ISO-8601 timestamp'; END;
    v_reconciled_available := (p_payload->>'reconciled_available_credit_centavos')::bigint;
    v_pre_reconciliation_available := (p_payload->>'pre_reconciliation_available_credit_centavos')::bigint;
    IF v_reconciled_available <> (p_payload->>'available_credit_centavos')::bigint THEN RAISE EXCEPTION 'issuer snapshot must match live available credit'; END IF;
    INSERT INTO public.applied_operations(operation_id, user_id, device_id, entity, record_id, operation_type, result)
    VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending')) ON CONFLICT (operation_id) DO NOTHING;
    IF NOT FOUND THEN
      SELECT user_id INTO v_existing_user FROM public.applied_operations WHERE operation_id = p_operation_id;
      IF v_existing_user IS DISTINCT FROM v_user_id THEN RETURN QUERY SELECT 'rejected', 'operation belongs to another user', NULL::integer, NULL::text[]; ELSE RETURN QUERY SELECT 'duplicate', NULL::text, NULL::integer, NULL::text[]; END IF;
      RETURN;
    END IF;
    SELECT version, credit_limit_centavos INTO v_version, v_current_credit_limit FROM public.credit_card_details WHERE account_id = p_record_id AND user_id = v_user_id AND deleted = false FOR UPDATE;
    IF v_version IS NULL THEN RAISE EXCEPTION 'credit-card details not found or inaccessible'; END IF;
    IF v_reconciled_available > v_current_credit_limit OR v_pre_reconciliation_available > v_current_credit_limit THEN RAISE EXCEPTION 'available credit cannot exceed the credit limit'; END IF;
    IF p_base_version IS NULL OR p_base_version <> v_version THEN
      UPDATE public.applied_operations SET result = jsonb_build_object('status', 'conflict', 'current_version', v_version, 'conflicted_fields', to_jsonb(p_changed_fields)) WHERE operation_id = p_operation_id;
      RETURN QUERY SELECT 'conflict', 'credit-card version changed', v_version, p_changed_fields; RETURN;
    END IF;
    UPDATE public.credit_card_details SET available_credit_centavos = v_reconciled_available, reconciled_available_credit_centavos = v_reconciled_available, pre_reconciliation_available_credit_centavos = v_pre_reconciliation_available, available_credit_reconciled_at = v_reconciled_at, version = version + 1, updated_at = now() WHERE account_id = p_record_id AND user_id = v_user_id AND deleted = false;
    UPDATE public.applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_version + 1) WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'applied', NULL::text, v_version + 1, NULL::text[]; RETURN;
  END IF;

  IF p_entity = 'credit_card_payments' AND p_operation_type IN ('update', 'delete') THEN
    SELECT payment.amount_centavos, cycle.account_id INTO v_previous_amount, v_account_id FROM public.credit_card_payments payment JOIN public.credit_card_cycles cycle ON cycle.id = payment.cycle_id AND cycle.user_id = payment.user_id WHERE payment.id = p_record_id AND payment.user_id = v_user_id AND payment.deleted = false FOR UPDATE;
  END IF;
  IF p_entity = 'credit_card_repayment_preferences' THEN
    RETURN QUERY SELECT * FROM private.apply_credit_card_repayment_preference_sync_operation_core(p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload); RETURN;
  END IF;
  SELECT * INTO v_result FROM private.apply_credit_card_sync_operation_core(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
  IF v_result.status <> 'applied' OR p_entity <> 'credit_card_payments' THEN RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields; RETURN; END IF;
  IF p_operation_type = 'delete' THEN v_delta := -v_previous_amount; ELSE SELECT payment.amount_centavos, cycle.account_id INTO v_current_amount, v_account_id FROM public.credit_card_payments payment JOIN public.credit_card_cycles cycle ON cycle.id = payment.cycle_id AND cycle.user_id = payment.user_id WHERE payment.id = p_record_id AND payment.user_id = v_user_id AND payment.deleted = false; v_delta := v_current_amount - COALESCE(v_previous_amount, 0); END IF;
  IF v_account_id IS NULL OR v_delta IS NULL THEN RAISE EXCEPTION 'credit-card payment card is invalid'; END IF;
  IF v_delta <> 0 THEN PERFORM set_config('odin.credit_card_invariant_path', 'true', true); UPDATE public.credit_card_details SET available_credit_centavos = LEAST(credit_limit_centavos, COALESCE(available_credit_centavos, credit_limit_centavos) + v_delta), version = version + 1, updated_at = now() WHERE account_id = v_account_id AND user_id = v_user_id AND deleted = false; IF NOT FOUND THEN RAISE EXCEPTION 'credit-card details not found'; END IF; END IF;
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;
