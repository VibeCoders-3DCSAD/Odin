-- Align installment lifecycle names and allow historical/backfilled creates.
-- New-purchase creation still defaults to active in the client; completed is only
-- for issuer-recognized settlement/final-payment paths.

UPDATE public.credit_card_installments
   SET settlement_status = 'early_settlement_requested'
 WHERE settlement_status = 'settlement_requested';

ALTER TABLE public.credit_card_installments
  DROP CONSTRAINT IF EXISTS credit_card_installments_settlement_status_check;

ALTER TABLE public.credit_card_installments
  ADD CONSTRAINT credit_card_installments_settlement_status_check
  CHECK (settlement_status IN ('active', 'early_settlement_requested', 'completed'));

-- Amortization is issuer-provided/user-confirmed, not derived from principal.
-- Interest-bearing products can have amortization that does not equal a simple
-- principal/term formula, and historical entries may reflect issuer schedules.
DROP TRIGGER IF EXISTS credit_card_installment_amortization_guard ON public.credit_card_installments;
DROP FUNCTION IF EXISTS public.assert_credit_card_installment_amortization();

CREATE OR REPLACE FUNCTION public.guard_credit_card_derived_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
END;
$$;

DO $$
DECLARE
  function_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO function_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'apply_credit_card_sync_operation_core'
     AND p.pronargs = 8;

  IF function_definition IS NOT NULL THEN
    function_definition := replace(
      function_definition,
      '''active'',''settlement_requested'',''completed''',
      '''active'',''early_settlement_requested'',''completed'''
    );
    EXECUTE function_definition;
  END IF;
END $$;
