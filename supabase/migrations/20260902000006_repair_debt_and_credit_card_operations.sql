-- Keep the complete hardened debt flow available to the final invariant wrapper.
CREATE OR REPLACE FUNCTION apply_debt_sync_operation_hardened(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
#variable_conflict use_column
DECLARE
  v_user_id uuid := auth.uid();
  v_transaction_type text; v_source_account_id uuid; v_subcategory_id uuid;
  v_client_mutation_id text; v_amount bigint; v_balance_debited boolean;
  v_transaction_operation_applied boolean; v_current_version integer;
  v_item jsonb;
  v_principal bigint; v_interest bigint; v_debt_id uuid;
  v_payment_version integer; v_payment_amount bigint; v_current_balance bigint;
  v_existing_user_id uuid; v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN RAISE EXCEPTION 'invalid device id'; END IF;
  IF octet_length(COALESCE(p_payload, '{}'::jsonb)::text) > 256000 THEN RAISE EXCEPTION 'debt payload is too large'; END IF;
  IF cardinality(COALESCE(p_changed_fields, ARRAY[]::text[])) > 50 THEN RAISE EXCEPTION 'too many changed fields'; END IF;
  IF p_entity NOT IN ('debt_accounts', 'debt_payments', 'user_debt_priorities', 'debt_strategy_preferences') THEN RAISE EXCEPTION 'entity % is not a debt entity', p_entity; END IF;
  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'unsupported operation'; END IF;
  IF p_entity = 'debt_payments' THEN
    IF p_operation_type <> 'create' THEN RAISE EXCEPTION 'debt payments can only be created through Debt Manager'; END IF;
    IF NULLIF(p_payload->>'debt_account_id', '') IS NULL THEN RAISE EXCEPTION 'debt_account_id is required'; END IF;
    IF p_payload->>'source' NOT IN ('transaction', 'manual') THEN RAISE EXCEPTION 'debt payment source is invalid'; END IF;
    IF p_payload->>'source' = 'transaction' AND (NULLIF(p_payload->>'transaction_id', '') IS NULL OR NULLIF(p_payload->>'linked_source_account_id', '') IS NULL OR NULLIF(p_payload->>'linked_subcategory_id', '') IS NULL OR p_payload->>'linked_transaction_type' <> 'expense') THEN RAISE EXCEPTION 'linked debt payment fields are invalid'; END IF;
    IF p_payload->>'source' = 'manual' AND NULLIF(p_payload->>'transaction_id', '') IS NOT NULL THEN RAISE EXCEPTION 'manual debt payments cannot have a transaction'; END IF;
    IF COALESCE(p_payload->>'amount_centavos', '') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'payment amount must be a positive integer'; END IF;
    IF (p_payload->>'principal_centavos') IS NOT NULL AND (p_payload->>'principal_centavos') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'principal amount must be a non-negative integer'; END IF;
    IF (p_payload->>'interest_centavos') IS NOT NULL AND (p_payload->>'interest_centavos') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'interest amount must be a non-negative integer'; END IF;
    IF COALESCE((p_payload->>'principal_centavos')::bigint, 0) + COALESCE((p_payload->>'interest_centavos')::bigint, 0) > (p_payload->>'amount_centavos')::bigint THEN RAISE EXCEPTION 'principal and interest cannot exceed payment amount'; END IF;
    IF NULLIF(p_payload->>'payment_date', '') IS NULL THEN RAISE EXCEPTION 'payment_date is required'; END IF;
  END IF;
  IF p_entity = 'user_debt_priorities' AND p_operation_type = 'update' THEN
    IF cardinality(COALESCE(p_changed_fields, ARRAY[]::text[])) = 0 THEN RAISE EXCEPTION 'priority updates must include changed fields'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':debt-priorities', 0));
    SELECT MAX(version) INTO v_current_version FROM user_debt_priorities WHERE user_id = v_user_id;
    IF p_base_version IS DISTINCT FROM v_current_version THEN
      RETURN QUERY SELECT 'conflict'::text, 'debt priority version changed'::text, v_current_version, ARRAY['priorities']::text[]; RETURN;
    END IF;
    IF jsonb_array_length(COALESCE(p_payload->'priorities', '[]'::jsonb)) <> (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(COALESCE(p_payload->'priorities', '[]'::jsonb)) AS items(value)) THEN RAISE EXCEPTION 'priority list contains duplicate debts'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'priorities', '[]'::jsonb)) LOOP
      IF NOT EXISTS (SELECT 1 FROM debt_accounts da WHERE da.id=(v_item #>> '{}')::uuid AND da.user_id=v_user_id AND da.deleted=false AND da.status='active') THEN RAISE EXCEPTION 'priority references an inactive or inaccessible debt'; END IF;
    END LOOP;
  END IF;
  IF p_entity = 'debt_payments' AND p_operation_type = 'create'
     AND (p_payload->>'principal_centavos') ~ '^[0-9]+$'
     AND (p_payload->>'interest_centavos') ~ '^[0-9]+$' THEN
    v_principal := (p_payload->>'principal_centavos')::bigint; v_interest := (p_payload->>'interest_centavos')::bigint;
    IF v_principal + v_interest > (p_payload->>'amount_centavos')::bigint THEN RAISE EXCEPTION 'principal and interest cannot exceed payment amount'; END IF;
  END IF;
  IF p_entity = 'debt_payments' AND p_operation_type = 'create' AND NOT EXISTS (SELECT 1 FROM applied_operations WHERE operation_id = p_operation_id) AND (p_payload->>'amount_centavos') ~ '^[1-9][0-9]*$' THEN
    v_debt_id := NULLIF(p_payload->>'debt_account_id', '')::uuid;
    SELECT da.current_balance_centavos INTO v_current_balance FROM debt_accounts da WHERE da.id=v_debt_id AND da.user_id=v_user_id AND da.deleted=false AND da.status='active' FOR UPDATE;
    IF FOUND AND (p_payload->>'amount_centavos')::bigint > v_current_balance THEN RAISE EXCEPTION 'payment exceeds current debt balance'; END IF;
  END IF;
  IF p_entity = 'debt_payments' AND p_operation_type = 'update' THEN
    IF p_payload->>'source' <> 'transaction' OR NULLIF(p_payload->>'transaction_id','') IS NULL THEN RAISE EXCEPTION 'debt payment updates must link a transaction'; END IF;
    SELECT dp.version,dp.amount_centavos INTO v_payment_version,v_payment_amount FROM debt_payments dp WHERE dp.id=p_record_id AND dp.user_id=v_user_id AND dp.deleted=false FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'debt payment not found or inaccessible'; END IF;
    IF p_base_version IS NOT NULL AND p_base_version <> v_payment_version THEN DELETE FROM applied_operations WHERE operation_id=p_operation_id; RETURN QUERY SELECT 'conflict'::text,'debt payment version changed'::text,v_payment_version,ARRAY['transaction_id']::text[]; RETURN; END IF;
    SELECT t.transaction_type::text,t.amount_centavos,t.source_account_id,t.subcategory_id,t.client_mutation_id INTO v_transaction_type,v_amount,v_source_account_id,v_subcategory_id,v_client_mutation_id FROM transactions t WHERE t.id=NULLIF(p_payload->>'transaction_id','')::uuid AND t.user_id=v_user_id AND t.deleted=false AND t.status='posted';
    IF NOT FOUND THEN RAISE EXCEPTION 'linked transaction not found'; END IF;
    IF v_amount IS DISTINCT FROM v_payment_amount THEN RAISE EXCEPTION 'linked transaction amount does not match payment amount'; END IF;
    IF v_transaction_type <> 'expense' OR v_client_mutation_id IS DISTINCT FROM 'debt-payment:'||p_record_id::text OR v_source_account_id IS DISTINCT FROM NULLIF(p_payload->>'linked_source_account_id','')::uuid OR v_subcategory_id IS DISTINCT FROM NULLIF(p_payload->>'linked_subcategory_id','')::uuid THEN RAISE EXCEPTION 'linked transaction fields do not match transaction'; END IF;
    IF NOT EXISTS (SELECT 1 FROM applied_operations WHERE user_id=v_user_id AND entity='transactions' AND record_id=NULLIF(p_payload->>'transaction_id','')::uuid AND result->>'status'='applied') THEN RAISE EXCEPTION 'linked transaction has not been synced'; END IF;
    UPDATE debt_payments SET transaction_id=NULLIF(p_payload->>'transaction_id','')::uuid,source='transaction',payment_date=(p_payload->>'payment_date')::date,version=v_payment_version+1,updated_at=now() WHERE id=p_record_id AND user_id=v_user_id AND transaction_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'debt payment is already linked'; END IF;
    UPDATE applied_operations SET result=jsonb_build_object('status','applied','current_version',v_payment_version+1) WHERE operation_id=p_operation_id;
    RETURN QUERY SELECT 'applied'::text,NULL::text,v_payment_version+1,NULL::text[]; RETURN;
  END IF;
  IF p_entity = 'debt_payments' AND p_operation_type = 'create' THEN
    SELECT t.transaction_type::text,t.source_account_id,t.subcategory_id,t.client_mutation_id INTO v_transaction_type,v_source_account_id,v_subcategory_id,v_client_mutation_id FROM transactions t WHERE t.id=NULLIF(p_payload->>'transaction_id','')::uuid AND t.user_id=v_user_id;
    IF FOUND THEN
      IF v_client_mutation_id IS DISTINCT FROM 'debt-payment:'||p_record_id::text THEN RAISE EXCEPTION 'transaction was not created by Debt Manager'; END IF;
      IF v_transaction_type <> COALESCE(p_payload->>'linked_transaction_type','') OR v_source_account_id IS DISTINCT FROM NULLIF(p_payload->>'linked_source_account_id','')::uuid OR v_subcategory_id IS DISTINCT FROM NULLIF(p_payload->>'linked_subcategory_id','')::uuid THEN RAISE EXCEPTION 'linked transaction fields do not match transaction'; END IF;
      v_amount := (p_payload->>'amount_centavos')::bigint;
      SELECT EXISTS(SELECT 1 FROM applied_operations WHERE user_id=v_user_id AND entity='transactions' AND record_id=NULLIF(p_payload->>'transaction_id','')::uuid AND result->>'status'='applied') INTO v_transaction_operation_applied;
      v_balance_debited := COALESCE(v_transaction_operation_applied,false);
      IF NOT v_balance_debited THEN
        UPDATE financial_accounts SET current_balance_centavos=current_balance_centavos-v_amount,version=version+1,updated_at=now() WHERE id=v_source_account_id AND user_id=v_user_id AND deleted=false AND current_balance_centavos>=v_amount;
        IF NOT FOUND THEN RAISE EXCEPTION 'source account has insufficient balance'; END IF;
        PERFORM set_config('odin.debt_payment_balance_debited','true',true);
        UPDATE transactions SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{debt_payment_balance_debited}','true'::jsonb),version=version+1,updated_at=now() WHERE id=NULLIF(p_payload->>'transaction_id','')::uuid AND user_id=v_user_id;
      END IF;
      IF v_balance_debited THEN PERFORM set_config('odin.debt_payment_balance_debited','true',true); END IF;
    END IF;
  END IF;
  IF p_entity='debt_payments' AND p_operation_type='create' THEN
    v_debt_id := NULLIF(p_payload->>'debt_account_id','')::uuid;
    UPDATE debt_accounts da SET paid_off_at=COALESCE(da.paid_off_at,now()) WHERE da.id=v_debt_id AND da.user_id=v_user_id AND da.status='active' AND da.current_balance_centavos=(p_payload->>'amount_centavos')::bigint;
  ELSIF p_entity='debt_accounts' AND p_operation_type='update' AND p_payload ? 'status' THEN
    UPDATE debt_accounts da SET paid_off_at=CASE WHEN p_payload->>'status'='paid_off' THEN COALESCE(da.paid_off_at,now()) ELSE NULL END WHERE da.id=p_record_id AND da.user_id=v_user_id;
  END IF;
  -- v1 owns the aggregate mutations; this wrapper performs the authoritative
  -- linked-transaction debit and validation before handing off to it.
  SELECT * INTO v_result FROM apply_debt_sync_operation_v1(p_operation_id,p_device_id,p_entity,p_record_id,p_operation_type,p_base_version,p_changed_fields,p_payload);
  RETURN QUERY SELECT v_result.status,v_result.reason,v_result.current_version,v_result.conflicted_fields;
END; $$;

GRANT EXECUTE ON FUNCTION apply_debt_sync_operation_hardened(uuid,text,text,uuid,text,integer,text[],jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION apply_debt_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_user uuid := auth.uid(); v_existing uuid; v_balance bigint; v_version integer; v_result record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity='debt_accounts' AND p_operation_type='create' THEN
    SELECT user_id INTO v_existing FROM debt_accounts WHERE id=p_record_id;
    IF FOUND THEN
      IF v_existing=v_user THEN RETURN QUERY SELECT 'duplicate'::text,NULL::text,NULL::integer,NULL::text[];
      ELSE RETURN QUERY SELECT 'rejected'::text,'debt record belongs to another user'::text,NULL::integer,NULL::text[]; END IF;
      RETURN;
    END IF;
    IF p_payload->>'status'='paid_off' AND COALESCE((p_payload->>'current_balance_centavos')::bigint,0)<>0 THEN RAISE EXCEPTION 'paid_off status requires a zero balance'; END IF;
  END IF;
  IF p_entity='debt_accounts' AND p_operation_type='update' AND p_payload->>'status'='paid_off' THEN
    SELECT current_balance_centavos INTO v_balance FROM debt_accounts WHERE id=p_record_id AND user_id=v_user AND deleted=false;
    IF v_balance IS NULL OR v_balance<>0 THEN RAISE EXCEPTION 'paid_off status requires a zero balance'; END IF;
  END IF;
  IF p_entity='debt_strategy_preferences' AND p_operation_type='update' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text||':debt-strategy',0));
    SELECT version INTO v_version FROM debt_strategy_preferences WHERE user_id=v_user AND deleted=false;
    IF p_base_version IS DISTINCT FROM v_version THEN RETURN QUERY SELECT 'conflict'::text,'debt strategy version changed'::text,v_version,ARRAY['strategy']::text[]; RETURN; END IF;
  END IF;
  SELECT * INTO v_result FROM apply_debt_sync_operation_hardened(p_operation_id,p_device_id,p_entity,p_record_id,p_operation_type,p_base_version,p_changed_fields,p_payload);
  IF p_entity='debt_accounts' AND p_operation_type IN ('create','update') AND v_result.status='applied' THEN
    UPDATE debt_accounts SET archived_at=CASE WHEN p_payload->>'status'='archived' THEN COALESCE(archived_at,now()) WHEN p_payload ? 'status' THEN NULL ELSE archived_at END,
      paid_off_at=CASE WHEN p_payload->>'status'='paid_off' THEN COALESCE(paid_off_at,now()) WHEN p_payload ? 'status' THEN NULL ELSE paid_off_at END
      WHERE id=p_record_id AND user_id=v_user;
  END IF;
  RETURN QUERY SELECT v_result.status,v_result.reason,v_result.current_version,v_result.conflicted_fields;
END; $$;
GRANT EXECUTE ON FUNCTION apply_debt_sync_operation(uuid,text,text,uuid,text,integer,text[],jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user uuid := auth.uid(); v_amount bigint; v_available bigint; v_limit bigint;
  v_account uuid; v_cycle uuid; v_tx record; v_payment record; v_result record;
  v_existing_user uuid; v_key text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN RAISE EXCEPTION 'invalid device id'; END IF;
  IF p_entity NOT IN ('credit_card_details','credit_card_cycles','credit_card_installments','credit_card_transactions','credit_card_statements','credit_card_payments','credit_card_credit_applications','credit_card_settlements','credit_card_statement_strategies') THEN RAISE EXCEPTION 'entity is not a credit-card entity'; END IF;
  IF p_operation_type NOT IN ('create','update','delete') THEN RAISE EXCEPTION 'unsupported operation'; END IF;
  IF p_operation_type = 'create' THEN
    IF p_entity IN ('credit_card_transactions','credit_card_payments','credit_card_credit_applications') AND p_payload ? 'client_mutation_id' THEN
      EXECUTE format('SELECT user_id FROM %I WHERE client_mutation_id=$1 AND deleted=false', p_entity) INTO v_existing_user USING p_payload->>'client_mutation_id';
      IF v_existing_user IS NOT NULL THEN
        IF v_existing_user IS DISTINCT FROM v_user THEN RETURN QUERY SELECT 'rejected'::text,'mutation belongs to another user'::text,NULL::integer,NULL::text[];
        ELSE RETURN QUERY SELECT 'duplicate'::text,NULL::text,NULL::integer,NULL::text[]; END IF;
        RETURN;
      END IF;
    END IF;
    v_key := CASE p_entity WHEN 'credit_card_details' THEN 'account_id' WHEN 'credit_card_transactions' THEN 'transaction_id' WHEN 'credit_card_statement_strategies' THEN 'statement_id' ELSE 'id' END;
    EXECUTE format('SELECT user_id FROM %I WHERE %I=$1', p_entity, v_key) INTO v_existing_user USING p_record_id;
    IF v_existing_user IS NOT NULL THEN
      IF v_existing_user IS DISTINCT FROM v_user THEN
        RETURN QUERY SELECT 'rejected'::text, 'record belongs to another user'::text, NULL::integer, NULL::text[];
      ELSE
        RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
      END IF;
      RETURN;
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM applied_operations WHERE operation_id=p_operation_id) THEN
    IF p_entity='credit_card_transactions' AND p_operation_type='create' THEN
      SELECT t.* INTO v_tx FROM transactions t WHERE t.id=NULLIF(p_payload->>'transaction_id','')::uuid AND t.user_id=v_user AND t.deleted=false;
      IF NOT FOUND OR v_tx.transaction_type <> 'expense' THEN RAISE EXCEPTION 'credit-card purchase transaction is invalid'; END IF;
      v_account := NULLIF(p_payload->>'account_id','')::uuid; v_cycle := NULLIF(p_payload->>'cycle_id','')::uuid;
      v_amount := CASE WHEN p_payload->>'purchase_type'='installment'
        THEN (SELECT i.original_principal_centavos FROM credit_card_installments i WHERE i.id=NULLIF(p_payload->>'installment_id','')::uuid AND i.user_id=v_user AND i.deleted=false)
        ELSE v_tx.amount_centavos END;
      IF v_tx.source_account_id IS DISTINCT FROM v_account OR NOT EXISTS (SELECT 1 FROM credit_card_cycles c JOIN financial_accounts a ON a.id=c.account_id WHERE c.id=v_cycle AND c.user_id=v_user AND c.account_id=v_account AND c.deleted=false AND COALESCE(v_tx.credit_card_posting_date,v_tx.transaction_date) BETWEEN c.cycle_start_date AND c.cutoff_date) THEN RAISE EXCEPTION 'credit-card purchase relationship or cycle is invalid'; END IF;
      IF p_payload->>'purchase_type'='installment' AND NOT EXISTS (SELECT 1 FROM credit_card_installments i WHERE i.id=NULLIF(p_payload->>'installment_id','')::uuid AND i.user_id=v_user AND i.account_id=v_account AND i.transaction_id=v_tx.id AND i.deleted=false) THEN RAISE EXCEPTION 'installment transaction link is invalid'; END IF;
      SELECT d.available_credit_centavos,d.credit_limit_centavos INTO v_available,v_limit FROM credit_card_details d WHERE d.account_id=v_account AND d.user_id=v_user AND d.deleted=false FOR UPDATE;
      IF NOT FOUND OR COALESCE(v_available,v_limit) < v_amount THEN RAISE EXCEPTION 'purchase exceeds available credit'; END IF;
      UPDATE credit_card_details SET available_credit_centavos=COALESCE(available_credit_centavos,credit_limit_centavos)-v_amount,version=version+1,updated_at=now() WHERE account_id=v_account AND user_id=v_user AND deleted=false;
    ELSIF p_entity='credit_card_payments' AND p_operation_type='create' THEN
      SELECT c.account_id INTO v_account FROM credit_card_cycles c WHERE c.id=NULLIF(p_payload->>'cycle_id','')::uuid AND c.user_id=v_user AND c.deleted=false;
      IF NOT FOUND THEN RAISE EXCEPTION 'payment cycle is invalid'; END IF;
      IF p_payload ? 'source_account_id' AND NULLIF(p_payload->>'source_account_id','') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financial_accounts WHERE id=(p_payload->>'source_account_id')::uuid AND user_id=v_user AND deleted=false) THEN RAISE EXCEPTION 'payment source account is inaccessible'; END IF;
      IF p_payload ? 'transaction_id' AND NULLIF(p_payload->>'transaction_id','') IS NOT NULL THEN
        SELECT t.* INTO v_tx FROM transactions t WHERE t.id=(p_payload->>'transaction_id')::uuid AND t.user_id=v_user AND t.deleted=false;
        IF NOT FOUND OR v_tx.transaction_type <> 'expense' OR v_tx.amount_centavos <> (p_payload->>'amount_centavos')::bigint OR v_tx.source_account_id IS DISTINCT FROM NULLIF(p_payload->>'source_account_id','')::uuid THEN RAISE EXCEPTION 'payment transaction does not match payment'; END IF;
      END IF;
    ELSIF p_entity='credit_card_installments' AND p_operation_type='create' AND NULLIF(p_payload->>'transaction_id','') IS NOT NULL THEN
      v_account := NULLIF(p_payload->>'account_id','')::uuid;
      IF NOT EXISTS (SELECT 1 FROM credit_card_transactions ct JOIN transactions t ON t.id=ct.transaction_id WHERE ct.transaction_id=(p_payload->>'transaction_id')::uuid AND ct.user_id=v_user AND ct.account_id=v_account AND t.user_id=v_user AND t.deleted=false) THEN RAISE EXCEPTION 'installment transaction link is invalid'; END IF;
    ELSIF p_entity='credit_card_credit_applications' AND p_operation_type='create' THEN
      SELECT p.*,c.account_id INTO v_payment FROM credit_card_payments p JOIN credit_card_cycles c ON c.id=p.cycle_id WHERE p.id=NULLIF(p_payload->>'payment_id','')::uuid AND p.user_id=v_user AND p.deleted=false AND c.user_id=v_user;
      IF NOT FOUND OR (p_payload->>'account_id')::uuid IS DISTINCT FROM v_payment.account_id THEN RAISE EXCEPTION 'credit application payment is invalid'; END IF;
      v_amount := (p_payload->>'amount_centavos')::bigint;
      SELECT available_credit_centavos,credit_limit_centavos INTO v_available,v_limit FROM credit_card_details WHERE account_id=v_payment.account_id AND user_id=v_user AND deleted=false FOR UPDATE;
       IF NOT FOUND OR v_payment.statement_id IS NULL OR v_amount > GREATEST(0, v_payment.amount_centavos-COALESCE((SELECT s.statement_balance_centavos FROM credit_card_statements s WHERE s.id=v_payment.statement_id AND s.user_id=v_user),0)-COALESCE((SELECT SUM(a.amount_centavos) FROM credit_card_credit_applications a WHERE a.payment_id=v_payment.id AND a.user_id=v_user AND a.deleted=false),0)) THEN RAISE EXCEPTION 'credit application exceeds available credit balance'; END IF;
       IF NULLIF(p_payload->>'target_transaction_id','') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM credit_card_transactions ct JOIN transactions t ON t.id=ct.transaction_id WHERE ct.transaction_id=(p_payload->>'target_transaction_id')::uuid AND ct.account_id=v_payment.account_id AND ct.user_id=v_user AND t.user_id=v_user AND t.deleted=false) THEN RAISE EXCEPTION 'credit application target transaction is invalid'; END IF;
       UPDATE credit_card_details SET available_credit_centavos=COALESCE(available_credit_centavos,credit_limit_centavos)+v_amount WHERE account_id=v_payment.account_id AND user_id=v_user AND deleted=false;
       IF NULLIF(p_payload->>'target_transaction_id','') IS NOT NULL THEN UPDATE credit_card_transactions SET applied_credit_centavos=applied_credit_centavos+v_amount WHERE transaction_id=(p_payload->>'target_transaction_id')::uuid AND user_id=v_user AND deleted=false; END IF;
    END IF;
  END IF;
  SELECT * INTO v_result FROM apply_credit_card_sync_operation_core(p_operation_id,p_device_id,p_entity,p_record_id,p_operation_type,p_base_version,p_changed_fields,p_payload);
  RETURN QUERY SELECT v_result.status,v_result.reason,v_result.current_version,v_result.conflicted_fields;
END; $$;
GRANT EXECUTE ON FUNCTION apply_credit_card_sync_operation(uuid,text,text,uuid,text,integer,text[],jsonb) TO authenticated;
