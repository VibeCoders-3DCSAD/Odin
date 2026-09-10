ALTER TABLE public.credit_card_statement_strategies
  ADD COLUMN IF NOT EXISTS percentage_bps integer;

ALTER TABLE public.credit_card_statement_strategies
  DROP CONSTRAINT IF EXISTS credit_card_statement_strategies_strategy_check;

ALTER TABLE public.credit_card_statement_strategies
  ADD CONSTRAINT credit_card_statement_strategies_strategy_check
  CHECK (strategy IN ('pay_in_full', 'pay_minimum', 'percentage_of_statement', 'custom_payment'));

CREATE OR REPLACE FUNCTION public.apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance bigint;
  v_minimum bigint;
  v_target bigint;
  v_result record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity = 'credit_card_statement_strategies' AND p_operation_type IN ('create', 'update') THEN
    SELECT statement_balance_centavos, minimum_due_centavos INTO v_balance, v_minimum
      FROM public.credit_card_statements
     WHERE id = NULLIF(p_payload->>'statement_id', '')::uuid
       AND user_id = v_user AND authoritative = true AND deleted = false;
    IF v_balance IS NULL THEN
      RETURN QUERY SELECT 'rejected'::text, 'statement repayment strategy requires an authoritative owned statement'::text, NULL::integer, NULL::text[];
      RETURN;
    END IF;
    v_target := CASE p_payload->>'strategy'
      WHEN 'pay_in_full' THEN v_balance
      WHEN 'pay_minimum' THEN v_minimum
      WHEN 'custom_payment' THEN NULLIF(p_payload->>'custom_amount_centavos', '')::bigint
      WHEN 'percentage_of_statement' THEN round(v_balance * NULLIF(p_payload->>'percentage_bps', '')::numeric / 10000)
      ELSE NULL
    END;
    IF v_target IS NULL OR v_target < v_minimum OR v_target > v_balance THEN
      RETURN QUERY SELECT 'rejected'::text, 'statement repayment target must be between the minimum due and statement balance'::text, NULL::integer, NULL::text[];
      RETURN;
    END IF;
  END IF;

  IF p_entity = 'credit_card_settlements' AND p_operation_type IN ('create', 'update') AND NOT EXISTS (
    SELECT 1 FROM public.credit_card_installments
     WHERE id = NULLIF(p_payload->>'installment_id', '')::uuid
       AND user_id = v_user AND deleted = false
  ) THEN
    RETURN QUERY SELECT 'rejected'::text, 'settlement installment is not accessible'::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  SELECT * INTO v_result FROM public.apply_credit_card_sync_operation_v3(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
