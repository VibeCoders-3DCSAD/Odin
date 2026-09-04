CREATE OR REPLACE FUNCTION apply_credit_card_sync_operation_core(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing_user uuid;
  v_version integer;
  v_key text;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_field text;
  v_set text := '';
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity NOT IN ('credit_card_details','credit_card_cycles','credit_card_installments','credit_card_transactions','credit_card_statements','credit_card_payments','credit_card_credit_applications','credit_card_settlements','credit_card_statement_strategies') THEN RAISE EXCEPTION 'entity is not a credit-card entity'; END IF;
  IF p_operation_type NOT IN ('create','update','delete') THEN RAISE EXCEPTION 'unsupported operation'; END IF;
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN RAISE EXCEPTION 'invalid device id'; END IF;
  IF octet_length(v_payload::text) > 256000 THEN RAISE EXCEPTION 'credit-card payload is too large'; END IF;

  INSERT INTO applied_operations(operation_id,user_id,device_id,entity,record_id,operation_type,result)
  VALUES(p_operation_id,v_user,p_device_id,p_entity,p_record_id,p_operation_type,jsonb_build_object('status','pending'))
  ON CONFLICT(operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT user_id INTO v_existing_user FROM applied_operations WHERE operation_id = p_operation_id;
    IF v_existing_user IS DISTINCT FROM v_user THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
    ELSE
      RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
    END IF;
    RETURN;
  END IF;

  v_payload := v_payload || jsonb_build_object('user_id', v_user, 'version', 1, 'deleted', false, 'created_at', now(), 'updated_at', now());
  v_key := CASE p_entity WHEN 'credit_card_details' THEN 'account_id' WHEN 'credit_card_transactions' THEN 'transaction_id' WHEN 'credit_card_statement_strategies' THEN 'statement_id' ELSE 'id' END;
  IF p_entity = 'credit_card_details' THEN v_payload := jsonb_set(v_payload, '{account_id}', COALESCE(v_payload->'account_id', to_jsonb(p_record_id)), true); ELSE v_payload := jsonb_set(v_payload, ARRAY[v_key], to_jsonb(p_record_id), true); END IF;

  IF p_operation_type = 'create' THEN
    IF p_entity = 'credit_card_details' AND (v_payload->>'credit_limit_centavos' IS NULL OR v_payload->>'default_cutoff_date' IS NULL OR v_payload->>'default_statement_date' IS NULL) THEN RAISE EXCEPTION 'credit-card details required fields are missing'; END IF;
    IF p_entity = 'credit_card_cycles' AND (v_payload->>'account_id' IS NULL OR v_payload->>'cycle_start_date' IS NULL OR v_payload->>'cutoff_date' IS NULL OR v_payload->>'statement_date' IS NULL) THEN RAISE EXCEPTION 'credit-card cycle required fields are missing'; END IF;
    IF p_entity = 'credit_card_installments' AND (v_payload->>'account_id' IS NULL OR v_payload->>'description' IS NULL OR v_payload->>'original_principal_centavos' IS NULL OR v_payload->>'remaining_principal_centavos' IS NULL OR v_payload->>'term_months' IS NULL OR v_payload->>'remaining_months' IS NULL OR v_payload->>'monthly_amortization_centavos' IS NULL OR v_payload->>'interest_type' IS NULL) THEN RAISE EXCEPTION 'credit-card installment required fields are missing'; END IF;
    IF p_entity = 'credit_card_transactions' AND (v_payload->>'account_id' IS NULL OR v_payload->>'cycle_id' IS NULL OR v_payload->>'purchase_type' IS NULL) THEN RAISE EXCEPTION 'credit-card transaction required fields are missing'; END IF;
    IF p_entity = 'credit_card_statements' AND (v_payload->>'cycle_id' IS NULL OR v_payload->>'statement_balance_centavos' IS NULL OR v_payload->>'minimum_due_centavos' IS NULL OR v_payload->>'due_date' IS NULL) THEN RAISE EXCEPTION 'credit-card statement required fields are missing'; END IF;
    IF p_entity = 'credit_card_payments' AND (v_payload->>'cycle_id' IS NULL OR v_payload->>'amount_centavos' IS NULL OR v_payload->>'payment_date' IS NULL) THEN RAISE EXCEPTION 'credit-card payment required fields are missing'; END IF;
    IF p_entity = 'credit_card_credit_applications' AND (v_payload->>'account_id' IS NULL OR v_payload->>'payment_id' IS NULL OR v_payload->>'amount_centavos' IS NULL OR v_payload->>'applied_date' IS NULL) THEN RAISE EXCEPTION 'credit-card application required fields are missing'; END IF;
    IF p_entity = 'credit_card_settlements' AND (v_payload->>'installment_id' IS NULL OR v_payload->>'settlement_date' IS NULL OR v_payload->>'settlement_amount_centavos' IS NULL OR v_payload->>'status' IS NULL) THEN RAISE EXCEPTION 'credit-card settlement required fields are missing'; END IF;
    IF p_entity = 'credit_card_statement_strategies' AND (v_payload->>'statement_id' IS NULL OR v_payload->>'strategy' IS NULL) THEN RAISE EXCEPTION 'credit-card strategy required fields are missing'; END IF;
  END IF;

  IF v_payload ? 'credit_limit_centavos' AND (v_payload->>'credit_limit_centavos') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'credit_limit_centavos must be positive'; END IF;
  FOREACH v_field IN ARRAY ARRAY['original_principal_centavos','term_months','monthly_amortization_centavos','amount_centavos','settlement_amount_centavos'] LOOP
    IF v_payload ? v_field AND (v_payload->>v_field) !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION '% must be positive', v_field; END IF;
  END LOOP;
  FOREACH v_field IN ARRAY ARRAY['available_credit_centavos','remaining_principal_centavos','remaining_months','interest_rate_bps','statement_balance_centavos','minimum_due_centavos','finance_charge_centavos','custom_amount_centavos','pretermination_fee_centavos'] LOOP
    IF v_payload ? v_field AND v_payload->>v_field IS NOT NULL AND (v_payload->>v_field) !~ '^[0-9]+$' THEN RAISE EXCEPTION '% must be non-negative', v_field; END IF;
  END LOOP;
  IF v_payload ? 'purchase_type' AND v_payload->>'purchase_type' NOT IN ('regular','installment') THEN RAISE EXCEPTION 'purchase_type is invalid'; END IF;
  IF v_payload ? 'interest_type' AND v_payload->>'interest_type' NOT IN ('zero_interest','interest_bearing') THEN RAISE EXCEPTION 'interest_type is invalid'; END IF;
  IF v_payload ? 'settlement_status' AND v_payload->>'settlement_status' NOT IN ('active','settlement_requested','completed') THEN RAISE EXCEPTION 'settlement_status is invalid'; END IF;
  IF p_entity = 'credit_card_settlements' AND v_payload->>'status' NOT IN ('requested','recognized','rejected') THEN RAISE EXCEPTION 'settlement status is invalid'; END IF;
  IF p_entity = 'credit_card_statements' AND (v_payload->>'minimum_due_centavos')::bigint > (v_payload->>'statement_balance_centavos')::bigint THEN RAISE EXCEPTION 'minimum due cannot exceed statement balance'; END IF;
  IF p_entity = 'credit_card_installments' AND (v_payload->>'remaining_principal_centavos')::bigint > (v_payload->>'original_principal_centavos')::bigint THEN RAISE EXCEPTION 'remaining principal cannot exceed original principal'; END IF;

  IF v_payload ? 'account_id' AND NOT EXISTS (SELECT 1 FROM financial_accounts WHERE id=(v_payload->>'account_id')::uuid AND user_id=v_user AND kind='credit_card' AND deleted=false) THEN RAISE EXCEPTION 'account_id does not reference an accessible credit card'; END IF;
  IF v_payload ? 'cycle_id' AND v_payload->>'cycle_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM credit_card_cycles WHERE id=(v_payload->>'cycle_id')::uuid AND user_id=v_user AND deleted=false AND (v_payload->>'account_id' IS NULL OR account_id=(v_payload->>'account_id')::uuid)) THEN RAISE EXCEPTION 'cycle_id does not belong to this user and card'; END IF;
  IF v_payload ? 'installment_id' AND v_payload->>'installment_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM credit_card_installments WHERE id=(v_payload->>'installment_id')::uuid AND user_id=v_user AND deleted=false AND (v_payload->>'account_id' IS NULL OR account_id=(v_payload->>'account_id')::uuid)) THEN RAISE EXCEPTION 'installment_id does not belong to this user and card'; END IF;
  IF v_payload ? 'statement_id' AND v_payload->>'statement_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM credit_card_statements s JOIN credit_card_cycles c ON c.id=s.cycle_id WHERE s.id=(v_payload->>'statement_id')::uuid AND s.user_id=v_user AND s.deleted=false AND (v_payload->>'cycle_id' IS NULL OR s.cycle_id=(v_payload->>'cycle_id')::uuid)) THEN RAISE EXCEPTION 'statement_id does not belong to this user and card'; END IF;
  IF v_payload ? 'payment_id' AND v_payload->>'payment_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM credit_card_payments WHERE id=(v_payload->>'payment_id')::uuid AND user_id=v_user AND deleted=false) THEN RAISE EXCEPTION 'payment_id does not belong to this user'; END IF;
  IF v_payload ? 'transaction_id' AND p_entity <> 'credit_card_transactions' AND v_payload->>'transaction_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM transactions WHERE id=(v_payload->>'transaction_id')::uuid AND user_id=v_user AND deleted=false) THEN RAISE EXCEPTION 'transaction_id does not belong to this user'; END IF;

  IF p_operation_type = 'create' THEN
    EXECUTE format('SELECT user_id FROM %I WHERE %I = $1', p_entity, v_key) INTO v_existing_user USING p_record_id;
    IF v_existing_user IS NOT NULL THEN
      IF v_existing_user IS DISTINCT FROM v_user THEN RETURN QUERY SELECT 'rejected'::text, 'record belongs to another user'::text, NULL::integer, NULL::text[]; ELSE RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[]; END IF;
      RETURN;
    END IF;
    EXECUTE format('INSERT INTO %I SELECT (jsonb_populate_record(NULL::%I, $1)).*', p_entity, p_entity) USING v_payload;
    UPDATE applied_operations SET result=jsonb_build_object('status','applied','current_version',1) WHERE operation_id=p_operation_id;
    RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
    RETURN;
  END IF;

  EXECUTE format('SELECT version FROM %I WHERE %I = $1 AND user_id = $2 AND deleted = false FOR UPDATE', p_entity, v_key) INTO v_version USING p_record_id, v_user;
  IF v_version IS NULL THEN RAISE EXCEPTION 'credit-card record not found or inaccessible'; END IF;
  IF p_operation_type = 'update' THEN
    IF p_base_version IS NULL OR p_base_version <> v_version THEN
      UPDATE applied_operations SET result=jsonb_build_object('status','conflict','current_version',v_version,'conflicted_fields',to_jsonb(p_changed_fields)) WHERE operation_id=p_operation_id;
      RETURN QUERY SELECT 'conflict'::text, 'credit-card version changed'::text, v_version, p_changed_fields;
      RETURN;
    END IF;
    FOREACH v_field IN ARRAY COALESCE(p_changed_fields, ARRAY[]::text[]) LOOP
      IF v_field NOT IN ('account_id','cycle_id','statement_id','transaction_id','installment_id','payment_id','target_transaction_id','client_mutation_id','applied_credit_centavos','issuer','credit_limit_centavos','available_credit_centavos','default_cutoff_date','default_statement_date','cycle_start_date','cutoff_date','statement_date','description','original_principal_centavos','remaining_principal_centavos','term_months','remaining_months','monthly_amortization_centavos','interest_rate_bps','interest_type','settlement_status','statement_balance_centavos','minimum_due_centavos','finance_charge_centavos','due_date','authoritative','amount_centavos','payment_date','source_account_id','notes','applied_date','settlement_date','pretermination_fee_centavos','status','strategy','custom_amount_centavos') THEN RAISE EXCEPTION '% is not syncable', v_field; END IF;
      IF v_payload ? v_field THEN v_set := v_set || CASE WHEN v_set = '' THEN '' ELSE ', ' END || format('%I = (jsonb_populate_record(NULL::%I, $1)).%I', v_field, p_entity, v_field); END IF;
    END LOOP;
    IF v_set = '' THEN RAISE EXCEPTION 'credit-card updates must include changed fields'; END IF;
    EXECUTE format('UPDATE %I SET %s, version=version+1, updated_at=now() WHERE %I=$2 AND user_id=$3', p_entity, v_set, v_key) USING v_payload, p_record_id, v_user;
    v_version := v_version + 1;
  ELSE
    EXECUTE format('UPDATE %I SET deleted=true, version=version+1, updated_at=now() WHERE %I=$1 AND user_id=$2', p_entity, v_key) USING p_record_id, v_user;
    v_version := v_version + 1;
  END IF;
  UPDATE applied_operations SET result=jsonb_build_object('status','applied','current_version',v_version) WHERE operation_id=p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_version, NULL::text[];
END $$;

GRANT EXECUTE ON FUNCTION apply_credit_card_sync_operation_core(uuid,text,text,uuid,text,integer,text[],jsonb) TO authenticated;
