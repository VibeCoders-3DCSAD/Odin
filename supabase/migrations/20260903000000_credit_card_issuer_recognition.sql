ALTER TABLE credit_card_payments
  ADD COLUMN IF NOT EXISTS issuer_recognized boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user uuid := auth.uid(); v_payment record; v_account uuid; v_existing uuid;
  v_amount bigint; v_result record; v_strategy text; v_custom bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity NOT LIKE 'credit_card_%' THEN RAISE EXCEPTION 'entity is not a credit-card entity'; END IF;

  IF p_entity = 'credit_card_statement_strategies' AND p_operation_type IN ('create','update') AND p_payload ? 'strategy' THEN
    v_strategy := p_payload->>'strategy';
    IF v_strategy NOT IN ('pay_full', 'pay_minimum', 'custom') THEN RAISE EXCEPTION 'strategy is invalid'; END IF;
    IF v_strategy = 'custom' THEN
      SELECT s.statement_balance_centavos, s.minimum_due_centavos INTO v_result
      FROM credit_card_statements s
      WHERE s.id=COALESCE(NULLIF(p_payload->>'statement_id','')::uuid,p_record_id) AND s.user_id=v_user AND s.deleted=false;
      IF NOT FOUND THEN RAISE EXCEPTION 'statement is inaccessible'; END IF;
      v_custom := NULLIF(p_payload->>'custom_amount_centavos','')::bigint;
      IF v_custom IS NULL OR v_custom < v_result.minimum_due_centavos OR v_custom >= v_result.statement_balance_centavos THEN
        RAISE EXCEPTION 'custom amount must be at least minimum due and less than statement balance';
      END IF;
    END IF;
  END IF;

  IF p_entity = 'credit_card_details' AND p_operation_type IN ('create','update')
     AND p_payload ? 'available_credit_centavos' AND p_payload->>'available_credit_centavos' IS NOT NULL THEN
    IF p_payload ? 'credit_limit_centavos' AND (p_payload->>'available_credit_centavos')::bigint > (p_payload->>'credit_limit_centavos')::bigint THEN
      RAISE EXCEPTION 'available credit cannot exceed credit limit';
    END IF;
    IF NOT p_payload ? 'credit_limit_centavos' AND EXISTS (
      SELECT 1 FROM credit_card_details d WHERE d.account_id=p_record_id AND d.user_id=v_user AND d.deleted=false
        AND (p_payload->>'available_credit_centavos')::bigint > d.credit_limit_centavos
    ) THEN RAISE EXCEPTION 'available credit cannot exceed credit limit'; END IF;
  END IF;

  IF p_entity = 'credit_card_payments' AND p_operation_type = 'update'
     AND p_payload->>'issuer_recognized' = 'true' THEN
    IF NOT ('issuer_recognized' = ANY(COALESCE(p_changed_fields, ARRAY[]::text[]))) THEN RAISE EXCEPTION 'issuer recognition requires its changed field'; END IF;
   SELECT p.*, c.account_id INTO v_payment
    FROM credit_card_payments p JOIN credit_card_cycles c ON c.id=p.cycle_id AND c.user_id=p.user_id
    WHERE p.id=p_record_id AND p.user_id=v_user AND p.deleted=false FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'credit-card payment not found or inaccessible'; END IF;
    IF p_base_version IS DISTINCT FROM v_payment.version THEN
      RETURN QUERY SELECT 'conflict'::text, 'credit-card payment version changed'::text, v_payment.version, ARRAY['issuer_recognized']::text[]; RETURN;
    END IF;
    IF v_payment.issuer_recognized THEN RAISE EXCEPTION 'payment is already issuer-recognized'; END IF;
    INSERT INTO applied_operations(operation_id,user_id,device_id,entity,record_id,operation_type,result)
      VALUES(p_operation_id,v_user,p_device_id,p_entity,p_record_id,p_operation_type,jsonb_build_object('status','pending'))
      ON CONFLICT(operation_id) DO NOTHING;
    IF NOT FOUND THEN RETURN QUERY SELECT 'duplicate'::text,NULL::text,NULL::integer,NULL::text[]; RETURN; END IF;
    UPDATE credit_card_payments SET issuer_recognized=true, version=version+1, updated_at=now()
      WHERE id=p_record_id AND user_id=v_user AND issuer_recognized=false;
    UPDATE credit_card_details SET available_credit_centavos=LEAST(credit_limit_centavos, COALESCE(available_credit_centavos,credit_limit_centavos)+v_payment.amount_centavos), version=version+1, updated_at=now()
      WHERE account_id=v_payment.account_id AND user_id=v_user AND deleted=false;
    UPDATE credit_card_installments SET remaining_principal_centavos=GREATEST(0,remaining_principal_centavos-monthly_amortization_centavos), remaining_months=GREATEST(0,remaining_months-1), settlement_status=CASE WHEN remaining_months<=1 THEN 'completed' ELSE settlement_status END, version=version+1, updated_at=now()
      WHERE id IN (SELECT installment_id FROM credit_card_transactions WHERE cycle_id=v_payment.cycle_id AND user_id=v_user AND installment_id IS NOT NULL) AND user_id=v_user AND deleted=false AND settlement_status='active';
    UPDATE applied_operations SET result=jsonb_build_object('status','applied','current_version',v_payment.version+1) WHERE operation_id=p_operation_id;
    RETURN QUERY SELECT 'applied'::text,NULL::text,v_payment.version+1,NULL::text[]; RETURN;
  END IF;

  -- Payment creation records issuer recognition state only; it never frees credit.
  SELECT * INTO v_result FROM apply_credit_card_sync_operation_core(p_operation_id,p_device_id,p_entity,p_record_id,p_operation_type,p_base_version,p_changed_fields,p_payload);
  RETURN QUERY SELECT v_result.status,v_result.reason,v_result.current_version,v_result.conflicted_fields;
END; $$;

GRANT EXECUTE ON FUNCTION apply_credit_card_sync_operation(uuid,text,text,uuid,text,integer,text[],jsonb) TO authenticated;
