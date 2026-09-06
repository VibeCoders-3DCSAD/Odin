ALTER FUNCTION apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_debt_sync_operation_v4;

CREATE OR REPLACE FUNCTION apply_debt_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user uuid := auth.uid();
  v_debt_id uuid;
  v_amount bigint;
  v_principal bigint;
  v_interest bigint;
  v_balance bigint;
  v_version integer;
BEGIN
  IF p_entity <> 'debt_payments' OR p_operation_type <> 'create' OR p_payload->>'source' <> 'manual' THEN
    RETURN QUERY SELECT * FROM apply_debt_sync_operation_v4(p_operation_id,p_device_id,p_entity,p_record_id,p_operation_type,p_base_version,p_changed_fields,p_payload);
    RETURN;
  END IF;
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF COALESCE(p_payload->>'amount_centavos','') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'payment amount must be a positive integer'; END IF;
  IF COALESCE(p_payload->>'principal_centavos',p_payload->>'amount_centavos') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'principal amount must be a non-negative integer'; END IF;
  IF p_payload->>'interest_centavos' IS NOT NULL AND p_payload->>'interest_centavos' !~ '^[0-9]+$' THEN RAISE EXCEPTION 'interest amount must be a non-negative integer'; END IF;

  INSERT INTO applied_operations(operation_id,user_id,device_id,entity,record_id,operation_type,result)
  VALUES(p_operation_id,v_user,p_device_id,p_entity,p_record_id,p_operation_type,jsonb_build_object('status','pending'))
  ON CONFLICT(operation_id) DO NOTHING;
  IF NOT FOUND THEN RETURN QUERY SELECT 'duplicate'::text,NULL::text,NULL::integer,NULL::text[]; RETURN; END IF;

  v_debt_id := NULLIF(p_payload->>'debt_account_id','')::uuid;
  v_amount := (p_payload->>'amount_centavos')::bigint;
  v_principal := COALESCE(NULLIF(p_payload->>'principal_centavos','')::bigint,v_amount);
  v_interest := COALESCE(NULLIF(p_payload->>'interest_centavos','')::bigint,0);
  IF v_principal + v_interest > v_amount THEN RAISE EXCEPTION 'principal and interest cannot exceed payment amount'; END IF;
  SELECT current_balance_centavos,version INTO v_balance,v_version FROM debt_accounts WHERE id=v_debt_id AND user_id=v_user AND deleted=false AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'debt_account_id does not reference an active debt'; END IF;
  IF v_principal > v_balance THEN RAISE EXCEPTION 'payment principal exceeds the current debt balance'; END IF;

  INSERT INTO debt_payments(id,debt_account_id,user_id,transaction_id,source,payment_date,amount_centavos,principal_centavos,interest_centavos,notes,version,deleted,updated_at)
  VALUES(p_record_id,v_debt_id,v_user,NULL,'manual',(p_payload->>'payment_date')::date,v_amount,v_principal,NULLIF(p_payload->>'interest_centavos','')::bigint,p_payload->>'notes',1,false,now());
  UPDATE debt_accounts SET current_balance_centavos=v_balance-v_principal,status=CASE WHEN v_balance-v_principal=0 THEN 'paid_off' ELSE status END,paid_off_at=CASE WHEN v_balance-v_principal=0 THEN COALESCE(paid_off_at,now()) ELSE paid_off_at END,version=v_version+1,updated_at=now() WHERE id=v_debt_id AND user_id=v_user;
  UPDATE applied_operations SET result=jsonb_build_object('status','applied','current_version',v_version+1) WHERE operation_id=p_operation_id;
  RETURN QUERY SELECT 'applied'::text,NULL::text,v_version+1,NULL::text[];
END $$;

GRANT EXECUTE ON FUNCTION apply_debt_sync_operation(uuid,text,text,uuid,text,integer,text[],jsonb) TO authenticated;

ALTER FUNCTION apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_credit_card_sync_operation_v2;

CREATE OR REPLACE FUNCTION apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user uuid := auth.uid();
  v_payment_version integer;
  v_amount bigint;
  v_account uuid;
BEGIN
  IF p_entity <> 'credit_card_payments' OR p_operation_type <> 'update' OR p_payload->>'issuer_recognized' <> 'true' THEN
    RETURN QUERY SELECT * FROM apply_credit_card_sync_operation_v2(p_operation_id,p_device_id,p_entity,p_record_id,p_operation_type,p_base_version,p_changed_fields,p_payload);
    RETURN;
  END IF;
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  INSERT INTO applied_operations(operation_id,user_id,device_id,entity,record_id,operation_type,result)
  VALUES(p_operation_id,v_user,p_device_id,p_entity,p_record_id,p_operation_type,jsonb_build_object('status','pending'))
  ON CONFLICT(operation_id) DO NOTHING;
  IF NOT FOUND THEN RETURN QUERY SELECT 'duplicate'::text,NULL::text,NULL::integer,NULL::text[]; RETURN; END IF;
  SELECT p.version,p.amount_centavos,c.account_id INTO v_payment_version,v_amount,v_account FROM credit_card_payments p JOIN credit_card_cycles c ON c.id=p.cycle_id AND c.user_id=p.user_id WHERE p.id=p_record_id AND p.user_id=v_user AND p.deleted=false AND p.issuer_recognized=false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'card payment is not available for confirmation'; END IF;
  IF p_base_version IS NOT NULL AND p_base_version <> v_payment_version THEN RETURN QUERY SELECT 'conflict'::text,'card payment version changed'::text,v_payment_version,ARRAY['issuer_recognized']::text[]; RETURN; END IF;
  UPDATE credit_card_payments SET issuer_recognized=true,version=v_payment_version+1,updated_at=now() WHERE id=p_record_id AND user_id=v_user;
  UPDATE credit_card_details SET available_credit_centavos=LEAST(credit_limit_centavos,COALESCE(available_credit_centavos,credit_limit_centavos)+v_amount),version=version+1,updated_at=now() WHERE account_id=v_account AND user_id=v_user AND deleted=false;
  IF NOT FOUND THEN RAISE EXCEPTION 'credit-card details not found'; END IF;
  UPDATE applied_operations SET result=jsonb_build_object('status','applied','current_version',v_payment_version+1) WHERE operation_id=p_operation_id;
  RETURN QUERY SELECT 'applied'::text,NULL::text,v_payment_version+1,NULL::text[];
END $$;

GRANT EXECUTE ON FUNCTION apply_credit_card_sync_operation(uuid,text,text,uuid,text,integer,text[],jsonb) TO authenticated;
