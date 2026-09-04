-- This trigger is shared by several tables. Read the row as JSON so a payment
-- row never attempts to access detail-only or installment-only fields.
CREATE OR REPLACE FUNCTION guard_credit_card_derived_writes() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
BEGIN
  IF current_setting('odin.credit_card_invariant_path', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'credit_card_details' AND TG_OP = 'INSERT'
     AND v_new->>'available_credit_centavos' IS NOT NULL THEN
    RAISE EXCEPTION 'available credit can only be initialized by a credit-card invariant operation';
  ELSIF TG_TABLE_NAME = 'credit_card_installments' AND TG_OP = 'INSERT' AND (
    v_new->>'remaining_principal_centavos' IS DISTINCT FROM v_new->>'original_principal_centavos'
    OR v_new->>'remaining_months' IS DISTINCT FROM v_new->>'term_months'
  ) THEN
    RAISE EXCEPTION 'installment remaining fields require a dedicated operation';
  ELSIF TG_TABLE_NAME = 'credit_card_details' AND TG_OP = 'UPDATE'
     AND v_new->>'available_credit_centavos' IS DISTINCT FROM v_old->>'available_credit_centavos' THEN
    RAISE EXCEPTION 'available credit can only be changed by a credit-card invariant operation';
  ELSIF TG_TABLE_NAME = 'credit_card_installments' AND TG_OP = 'UPDATE' AND (
    v_new->>'remaining_principal_centavos' IS DISTINCT FROM v_old->>'remaining_principal_centavos'
    OR v_new->>'remaining_months' IS DISTINCT FROM v_old->>'remaining_months'
    OR v_new->>'settlement_status' IS DISTINCT FROM v_old->>'settlement_status'
  ) THEN
    RAISE EXCEPTION 'installment settlement fields require a dedicated operation';
  ELSIF TG_TABLE_NAME = 'credit_card_transactions' AND TG_OP = 'UPDATE'
     AND v_new->>'applied_credit_centavos' IS DISTINCT FROM v_old->>'applied_credit_centavos' THEN
    RAISE EXCEPTION 'applied credit requires a dedicated operation';
  ELSIF TG_TABLE_NAME = 'credit_card_payments' AND TG_OP = 'UPDATE'
     AND v_new->>'issuer_recognized' IS DISTINCT FROM v_old->>'issuer_recognized' THEN
    RAISE EXCEPTION 'issuer recognition requires a dedicated operation';
  END IF;
  RETURN NEW;
END $$;
