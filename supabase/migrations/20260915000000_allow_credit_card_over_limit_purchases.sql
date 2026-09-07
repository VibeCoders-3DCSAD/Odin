-- A credit-card purchase may exceed the available credit. The app confirms this
-- explicitly before recording it, while the RPC continues to enforce ownership,
-- purchase shape, and cycle routing.
ALTER TABLE credit_card_details
  DROP CONSTRAINT IF EXISTS credit_card_details_available_credit_centavos_check;

CREATE OR REPLACE FUNCTION apply_credit_card_sync_operation_v3(
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
      IF v_existing_user IS DISTINCT FROM v_user THEN RETURN QUERY SELECT 'rejected'::text, 'record belongs to another user'::text, NULL::integer, NULL::text[];
      ELSE RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[]; END IF;
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
      IF NOT FOUND THEN RAISE EXCEPTION 'credit-card account is invalid'; END IF;
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

-- Keep credit-card transaction edits consistent with the same policy.
CREATE OR REPLACE FUNCTION reconcile_credit_card_purchase_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  IF OLD.amount_centavos IS NOT DISTINCT FROM NEW.amount_centavos THEN
    RETURN NEW;
  END IF;

  SELECT account_id
    INTO v_account_id
    FROM credit_card_transactions
   WHERE transaction_id = NEW.id
     AND user_id = NEW.user_id
     AND deleted = false;

  IF v_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('odin.credit_card_invariant_path', 'true', true);
  UPDATE credit_card_details
     SET available_credit_centavos = LEAST(
           credit_limit_centavos,
           COALESCE(available_credit_centavos, credit_limit_centavos)
             + OLD.amount_centavos - NEW.amount_centavos
         ),
         version = version + 1,
         updated_at = now()
   WHERE account_id = v_account_id
     AND user_id = NEW.user_id
     AND deleted = false;
  PERFORM set_config('odin.credit_card_invariant_path', 'false', true);

  RETURN NEW;
END;
$$;
