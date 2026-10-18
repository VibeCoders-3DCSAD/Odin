BEGIN;

INSERT INTO auth.users (id) VALUES ('7c000000-0000-4000-8000-000000000001');
INSERT INTO public.financial_accounts (id, user_id, name, kind, opening_balance_centavos, current_balance_centavos) VALUES
  ('7c000000-0000-4000-8000-0000000000a1', '7c000000-0000-4000-8000-000000000001', 'Card', 'credit_card', 0, 0);
INSERT INTO public.credit_card_details (account_id, user_id, credit_limit_centavos, cutoff_day) VALUES
  ('7c000000-0000-4000-8000-0000000000a1', '7c000000-0000-4000-8000-000000000001', 5000000, 15);

SELECT set_config('request.jwt.claim.sub', '7c000000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_card uuid := '7c000000-0000-4000-8000-0000000000a1';
  v_version integer;
  v_result record;
  v_detail record;
BEGIN
  SELECT version INTO v_version FROM public.credit_card_details WHERE account_id = v_card;

  SELECT * INTO v_result FROM public.apply_credit_card_sync_operation(gen_random_uuid(), 'device-1', 'credit_card_details', v_card, 'update', v_version,
    ARRAY['available_credit_centavos', 'reconciled_available_credit_centavos', 'pre_reconciliation_available_credit_centavos', 'available_credit_reconciled_at'],
    jsonb_build_object('available_credit_centavos', 3200000, 'reconciled_available_credit_centavos', 3200000,
      'pre_reconciliation_available_credit_centavos', 5000000, 'available_credit_reconciled_at', '2026-10-18T09:00:00+08:00'));
  IF v_result.status <> 'applied' THEN RAISE EXCEPTION 'issuer reconciliation must apply: %', v_result; END IF;

  SELECT * INTO v_detail FROM public.credit_card_details WHERE account_id = v_card;
  IF v_detail.available_credit_centavos <> 3200000 OR v_detail.reconciled_available_credit_centavos <> 3200000 OR v_detail.version <> v_version + 1 THEN
    RAISE EXCEPTION 'issuer reconciliation must store the snapshot: %', v_detail;
  END IF;

  -- The invariant flag is cleared again, so a direct write in the same transaction is still rejected.
  BEGIN
    UPDATE public.credit_card_details SET available_credit_centavos = 1 WHERE account_id = v_card;
    RAISE EXCEPTION 'direct available credit write must be rejected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'direct available credit write must be rejected' THEN RAISE; END IF;
  END;
END;
$$;

ROLLBACK;
