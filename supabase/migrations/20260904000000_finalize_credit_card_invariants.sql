CREATE OR REPLACE FUNCTION assert_credit_card_relationships() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'credit_card_transactions' AND (
    NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id=NEW.transaction_id AND t.user_id=NEW.user_id AND t.deleted=false)
    OR NOT EXISTS (SELECT 1 FROM credit_card_cycles c JOIN financial_accounts a ON a.id=c.account_id
      WHERE c.id=NEW.cycle_id AND c.account_id=NEW.account_id AND c.user_id=NEW.user_id AND c.deleted=false AND a.user_id=NEW.user_id AND a.kind='credit_card' AND a.deleted=false)
    OR NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id=NEW.transaction_id AND t.source_account_id=NEW.account_id AND t.user_id=NEW.user_id AND t.deleted=false)
  ) THEN RAISE EXCEPTION 'credit-card transaction relationship is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_statements' AND NOT EXISTS (
    SELECT 1 FROM credit_card_cycles c JOIN financial_accounts a ON a.id=c.account_id
    WHERE c.id=NEW.cycle_id AND c.user_id=NEW.user_id AND c.deleted=false AND a.user_id=NEW.user_id AND a.kind='credit_card' AND a.deleted=false
  ) THEN RAISE EXCEPTION 'statement cycle is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_payments' AND (
    NOT EXISTS (SELECT 1 FROM credit_card_cycles c JOIN financial_accounts a ON a.id=c.account_id WHERE c.id=NEW.cycle_id AND c.user_id=NEW.user_id AND c.deleted=false AND a.user_id=NEW.user_id AND a.kind='credit_card' AND a.deleted=false)
    OR (NEW.statement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM credit_card_statements WHERE id=NEW.statement_id AND cycle_id=NEW.cycle_id AND user_id=NEW.user_id AND deleted=false))
    OR (NEW.source_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financial_accounts WHERE id=NEW.source_account_id AND user_id=NEW.user_id AND deleted=false))
  ) THEN RAISE EXCEPTION 'payment relationship is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_installments' AND (
    NOT EXISTS (SELECT 1 FROM financial_accounts WHERE id=NEW.account_id AND user_id=NEW.user_id AND kind='credit_card' AND deleted=false)
    OR (NEW.transaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM transactions WHERE id=NEW.transaction_id AND source_account_id=NEW.account_id AND user_id=NEW.user_id AND deleted=false))
  ) THEN RAISE EXCEPTION 'installment relationship is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_credit_applications' AND (
    NOT EXISTS (SELECT 1 FROM credit_card_payments p JOIN credit_card_cycles c ON c.id=p.cycle_id WHERE p.id=NEW.payment_id AND p.user_id=NEW.user_id AND c.account_id=NEW.account_id AND p.deleted=false)
    OR (NEW.target_transaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM credit_card_transactions ct JOIN transactions t ON t.id=ct.transaction_id WHERE ct.transaction_id=NEW.target_transaction_id AND ct.account_id=NEW.account_id AND ct.user_id=NEW.user_id AND ct.deleted=false AND t.source_account_id=NEW.account_id AND t.user_id=NEW.user_id AND t.deleted=false))
  ) THEN RAISE EXCEPTION 'credit application relationship is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_settlements' AND NOT EXISTS (SELECT 1 FROM credit_card_installments WHERE id=NEW.installment_id AND user_id=NEW.user_id AND deleted=false) THEN RAISE EXCEPTION 'settlement installment is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_statement_strategies' AND NOT EXISTS (SELECT 1 FROM credit_card_statements WHERE id=NEW.statement_id AND user_id=NEW.user_id AND deleted=false) THEN RAISE EXCEPTION 'strategy statement is inaccessible'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION assert_credit_card_installment_amortization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected bigint;
BEGIN
  expected := CASE WHEN NEW.interest_type='zero_interest'
    THEN CEIL(NEW.original_principal_centavos::numeric / NEW.term_months)
    ELSE CEIL((NEW.original_principal_centavos * (10000 + NEW.interest_rate_bps))::numeric / (NEW.term_months * 10000)) END;
  IF NEW.monthly_amortization_centavos <> expected THEN RAISE EXCEPTION 'monthly amortization does not match installment formula'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS credit_card_installment_amortization_guard ON credit_card_installments;
CREATE TRIGGER credit_card_installment_amortization_guard BEFORE INSERT OR UPDATE ON credit_card_installments FOR EACH ROW EXECUTE FUNCTION assert_credit_card_installment_amortization();

CREATE OR REPLACE FUNCTION apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_user uuid := auth.uid(); v_result record; v_payment record; v_target record; v_tx record; v_amount bigint; v_available bigint; v_limit bigint; v_account uuid; v_existing_user uuid; v_applied bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT user_id INTO v_existing_user FROM applied_operations WHERE operation_id=p_operation_id;
  IF FOUND THEN
    IF v_existing_user IS DISTINCT FROM v_user THEN RETURN QUERY SELECT 'rejected'::text,'operation belongs to another user'::text,NULL::integer,NULL::text[];
    ELSE RETURN QUERY SELECT 'duplicate'::text,NULL::text,NULL::integer,NULL::text[]; END IF;
    RETURN;
  END IF;
  IF p_operation_type='create' AND p_entity IN ('credit_card_transactions','credit_card_payments','credit_card_credit_applications') AND p_payload ? 'client_mutation_id' THEN
    EXECUTE format('SELECT user_id FROM %I WHERE client_mutation_id=$1 AND deleted=false', p_entity) INTO v_existing_user USING p_payload->>'client_mutation_id';
    IF v_existing_user IS NOT NULL THEN
      IF v_existing_user IS DISTINCT FROM v_user THEN RETURN QUERY SELECT 'rejected'::text,'mutation belongs to another user'::text,NULL::integer,NULL::text[];
      ELSE RETURN QUERY SELECT 'duplicate'::text,NULL::text,NULL::integer,NULL::text[]; END IF;
      RETURN;
    END IF;
  END IF;
  IF p_entity='credit_card_transactions' AND p_operation_type='create' THEN
    SELECT t.* INTO v_tx FROM transactions t
    WHERE t.id=(p_payload->>'transaction_id')::uuid AND t.user_id=v_user AND t.deleted=false
    FOR UPDATE;
    IF NOT FOUND OR v_tx.transaction_type <> 'expense' THEN RAISE EXCEPTION 'credit-card purchase transaction is invalid'; END IF;
    v_account := (p_payload->>'account_id')::uuid;
    v_amount := v_tx.amount_centavos;
    IF p_payload->>'purchase_type'='installment' THEN
      SELECT original_principal_centavos INTO v_amount FROM credit_card_installments WHERE id=(p_payload->>'installment_id')::uuid AND user_id=v_user AND account_id=v_account AND transaction_id=v_tx.id AND deleted=false;
      IF NOT FOUND THEN RAISE EXCEPTION 'installment transaction link is invalid'; END IF;
    END IF;
    IF v_tx.source_account_id IS DISTINCT FROM v_account OR NOT EXISTS (SELECT 1 FROM credit_card_cycles c WHERE c.id=(p_payload->>'cycle_id')::uuid AND c.account_id=v_account AND c.user_id=v_user AND c.deleted=false) THEN RAISE EXCEPTION 'credit-card purchase relationship is invalid'; END IF;
    SELECT available_credit_centavos,credit_limit_centavos INTO v_available,v_limit
    FROM credit_card_details WHERE account_id=v_account AND user_id=v_user AND deleted=false FOR UPDATE;
    IF NOT FOUND OR COALESCE(v_available,v_limit) < v_amount THEN RAISE EXCEPTION 'purchase exceeds available credit'; END IF;
    PERFORM set_config('odin.credit_card_invariant_path','true',true);
    UPDATE credit_card_details
    SET available_credit_centavos=COALESCE(available_credit_centavos,credit_limit_centavos)-v_amount,
        version=version+1,updated_at=now()
      WHERE account_id=v_account AND user_id=v_user AND deleted=false;
  END IF;
  IF p_operation_type='create' AND p_entity IN ('credit_card_details','credit_card_installments') THEN
    IF p_entity='credit_card_details' AND p_payload ? 'available_credit_centavos' AND p_payload->>'available_credit_centavos' IS NOT NULL AND (p_payload->>'available_credit_centavos')::bigint > (p_payload->>'credit_limit_centavos')::bigint THEN RAISE EXCEPTION 'available credit cannot exceed credit limit'; END IF;
    IF p_entity='credit_card_installments' AND ((p_payload->>'remaining_principal_centavos')::bigint > (p_payload->>'original_principal_centavos')::bigint OR (p_payload->>'remaining_months')::integer > (p_payload->>'term_months')::integer) THEN RAISE EXCEPTION 'installment remaining values cannot exceed original values'; END IF;
    PERFORM set_config('odin.credit_card_invariant_path','true',true);
  END IF;
  IF p_entity='credit_card_payments' AND p_operation_type='update' AND p_payload->>'issuer_recognized'='true' THEN
    IF NOT ('issuer_recognized'=ANY(COALESCE(p_changed_fields,ARRAY[]::text[]))) THEN RAISE EXCEPTION 'issuer recognition requires its changed field'; END IF;
    SELECT p.*,c.account_id INTO v_payment FROM credit_card_payments p JOIN credit_card_cycles c ON c.id=p.cycle_id AND c.user_id=p.user_id WHERE p.id=p_record_id AND p.user_id=v_user AND p.deleted=false FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'credit-card payment not found or inaccessible'; END IF;
    IF p_base_version IS DISTINCT FROM v_payment.version THEN RETURN QUERY SELECT 'conflict'::text,'credit-card payment version changed'::text,v_payment.version,ARRAY['issuer_recognized']::text[]; RETURN; END IF;
    IF v_payment.issuer_recognized THEN RAISE EXCEPTION 'payment is already issuer-recognized'; END IF;
    INSERT INTO applied_operations(operation_id,user_id,device_id,entity,record_id,operation_type,result) VALUES(p_operation_id,v_user,p_device_id,p_entity,p_record_id,p_operation_type,jsonb_build_object('status','pending'));
    PERFORM set_config('odin.credit_card_invariant_path','true',true);
    UPDATE credit_card_payments SET issuer_recognized=true,version=version+1,updated_at=now() WHERE id=p_record_id AND user_id=v_user AND issuer_recognized=false;
    UPDATE credit_card_details SET available_credit_centavos=LEAST(credit_limit_centavos,COALESCE(available_credit_centavos,credit_limit_centavos)+v_payment.amount_centavos),version=version+1,updated_at=now() WHERE account_id=v_payment.account_id AND user_id=v_user AND deleted=false;
    UPDATE credit_card_installments SET remaining_principal_centavos=GREATEST(0,remaining_principal_centavos-monthly_amortization_centavos),remaining_months=GREATEST(0,remaining_months-1),settlement_status=CASE WHEN remaining_months<=1 THEN 'completed' ELSE settlement_status END,version=version+1,updated_at=now()
      WHERE id IN (SELECT ct.installment_id FROM credit_card_transactions ct WHERE ct.cycle_id=v_payment.cycle_id AND ct.user_id=v_user AND ct.installment_id IS NOT NULL AND ct.deleted=false) AND user_id=v_user AND deleted=false AND settlement_status='active';
    UPDATE applied_operations SET result=jsonb_build_object('status','applied','current_version',v_payment.version+1) WHERE operation_id=p_operation_id;
    RETURN QUERY SELECT 'applied'::text,NULL::text,v_payment.version+1,NULL::text[]; RETURN;
  END IF;
  IF p_entity='credit_card_credit_applications' AND p_operation_type='create' THEN
    SELECT p.*,c.account_id INTO v_payment FROM credit_card_payments p JOIN credit_card_cycles c ON c.id=p.cycle_id WHERE p.id=(p_payload->>'payment_id')::uuid AND p.user_id=v_user AND p.deleted=false AND c.user_id=v_user;
    IF NOT FOUND OR (p_payload->>'account_id')::uuid IS DISTINCT FROM v_payment.account_id THEN RAISE EXCEPTION 'credit application payment is invalid'; END IF;
    v_amount := (p_payload->>'amount_centavos')::bigint;
    SELECT COALESCE(SUM(amount_centavos),0) INTO v_applied FROM credit_card_credit_applications WHERE payment_id=v_payment.id AND user_id=v_user AND deleted=false;
    IF v_amount > GREATEST(0,v_payment.amount_centavos-COALESCE((SELECT statement_balance_centavos FROM credit_card_statements WHERE id=v_payment.statement_id AND user_id=v_user AND deleted=false),0)-v_applied) THEN RAISE EXCEPTION 'credit application exceeds available credit balance'; END IF;
    SELECT ct.applied_credit_centavos,t.amount_centavos INTO v_target FROM credit_card_transactions ct JOIN transactions t ON t.id=ct.transaction_id WHERE ct.transaction_id=NULLIF(p_payload->>'target_transaction_id','')::uuid AND ct.account_id=v_payment.account_id AND ct.user_id=v_user AND ct.deleted=false AND t.user_id=v_user AND t.deleted=false FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'credit application target transaction is invalid'; END IF;
    IF v_amount > GREATEST(0,v_target.amount_centavos-v_target.applied_credit_centavos) THEN RAISE EXCEPTION 'credit application exceeds target charge'; END IF;
    PERFORM set_config('odin.credit_card_invariant_path','true',true);
    UPDATE credit_card_transactions SET applied_credit_centavos=applied_credit_centavos+v_amount WHERE transaction_id=NULLIF(p_payload->>'target_transaction_id','')::uuid AND user_id=v_user AND deleted=false AND applied_credit_centavos+v_amount <= (SELECT amount_centavos FROM transactions WHERE id=transaction_id AND user_id=v_user AND deleted=false);
    IF NOT FOUND THEN RAISE EXCEPTION 'credit application exceeds target charge'; END IF;
    UPDATE credit_card_details SET available_credit_centavos=LEAST(credit_limit_centavos,COALESCE(available_credit_centavos,credit_limit_centavos)+v_amount),version=version+1,updated_at=now() WHERE account_id=v_payment.account_id AND user_id=v_user AND deleted=false;
  END IF;
  SELECT * INTO v_result FROM apply_credit_card_sync_operation_core(p_operation_id,p_device_id,p_entity,p_record_id,p_operation_type,p_base_version,p_changed_fields,p_payload);
  RETURN QUERY SELECT v_result.status,v_result.reason,v_result.current_version,v_result.conflicted_fields;
END $$;
GRANT EXECUTE ON FUNCTION apply_credit_card_sync_operation(uuid,text,text,uuid,text,integer,text[],jsonb) TO authenticated;
