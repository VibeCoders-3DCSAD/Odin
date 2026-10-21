BEGIN;
INSERT INTO auth.users (id) VALUES ('7e000000-0000-4000-8000-000000000001'), ('7e000000-0000-4000-8000-000000000002');
INSERT INTO public.financial_accounts (id, user_id, name, kind, status, deleted) VALUES
 ('7e000000-0000-4000-8000-0000000000a1', '7e000000-0000-4000-8000-000000000001', 'Interest reference test', 'savings', 'active', false),
 ('7e000000-0000-4000-8000-0000000000a2', '7e000000-0000-4000-8000-000000000002', 'Other owner', 'savings', 'active', false);
SELECT set_config('request.jwt.claim.sub', '7e000000-0000-4000-8000-000000000001', true);
DO $$
DECLARE
 result record;
 reference jsonb := '{"balanceBasis":"average_daily_balance","method":"compound","rateStructure":"tiered","notes":"Bank rules apply"}';
 operation uuid := gen_random_uuid();
 invalid jsonb;
BEGIN
 SELECT * INTO result FROM public.apply_sync_operation(operation, 'interest-test', 'savings_account_details', '7e000000-0000-4000-8000-0000000000a1', 'create', NULL,
  ARRAY['account_type','interest_reference'], jsonb_build_object('account_type','personal_savings','interest_reference',reference));
 IF result.status <> 'applied' THEN RAISE EXCEPTION 'create failed: %',result; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.savings_account_details WHERE account_id='7e000000-0000-4000-8000-0000000000a1' AND interest_reference=reference AND interest_rate_bps IS NULL AND version=1) THEN RAISE EXCEPTION 'reference create was not persisted'; END IF;

 SELECT * INTO result FROM public.apply_sync_operation(gen_random_uuid(), 'interest-test', 'savings_account_details', '7e000000-0000-4000-8000-0000000000a1', 'update', 1,
  ARRAY['interest_reference'], '{"interest_reference":{"method":"simple"}}');
 IF result.status <> 'applied' OR result.current_version <> 2 THEN RAISE EXCEPTION 'reference-only update failed: %',result; END IF;
 -- A different create targeting an existing detail record is also a no-op.
 PERFORM public.apply_sync_operation(gen_random_uuid(), 'interest-test', 'savings_account_details', '7e000000-0000-4000-8000-0000000000a1', 'create', NULL,
  ARRAY['account_type','interest_reference'], jsonb_build_object('account_type','personal_savings','interest_reference',reference));
 -- Retrying the create must not restore stale reference metadata.
 PERFORM public.apply_sync_operation(operation, 'interest-test', 'savings_account_details', '7e000000-0000-4000-8000-0000000000a1', 'create', NULL,
  ARRAY['account_type','interest_reference'], jsonb_build_object('account_type','personal_savings','interest_reference',reference));
 IF NOT EXISTS(SELECT 1 FROM public.savings_account_details WHERE account_id='7e000000-0000-4000-8000-0000000000a1' AND interest_reference='{"method":"simple"}'::jsonb AND version=2) THEN RAISE EXCEPTION 'duplicate operation overwrote metadata'; END IF;
 SELECT * INTO result FROM public.apply_sync_operation(gen_random_uuid(), 'interest-test', 'savings_account_details', '7e000000-0000-4000-8000-0000000000a1', 'update', 1,
  ARRAY['interest_reference'], '{"interest_reference":null}');
 IF result.status <> 'conflict' THEN RAISE EXCEPTION 'stale update was accepted'; END IF;
 SELECT * INTO result FROM public.apply_sync_operation(gen_random_uuid(), 'interest-test', 'savings_account_details', '7e000000-0000-4000-8000-0000000000a1', 'update', 2,
  ARRAY['interest_reference'], '{"interest_reference":null}');
 IF result.status <> 'applied' OR NOT EXISTS(SELECT 1 FROM public.savings_account_details WHERE account_id='7e000000-0000-4000-8000-0000000000a1' AND interest_reference IS NULL AND version=3) THEN RAISE EXCEPTION 'clearing metadata failed'; END IF;
 FOREACH invalid IN ARRAY ARRAY['[]'::jsonb, '{"method":"invalid"}'::jsonb, '{"notes":4}'::jsonb, '{"unknown":true}'::jsonb, jsonb_build_object('notes',repeat('x',1001))] LOOP
  BEGIN
   PERFORM public.apply_sync_operation(gen_random_uuid(), 'interest-test', 'savings_account_details', '7e000000-0000-4000-8000-0000000000a1', 'update', 3, ARRAY['interest_reference'],jsonb_build_object('interest_reference',invalid));
   RAISE EXCEPTION 'invalid metadata was accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invalid interest reference' THEN RAISE; END IF;
  END;
 END LOOP;
 BEGIN
  PERFORM public.apply_sync_operation(gen_random_uuid(), 'interest-test', 'savings_account_details', '7e000000-0000-4000-8000-0000000000a2', 'create', NULL, ARRAY['account_type','interest_reference'],jsonb_build_object('account_type','personal_savings','interest_reference',reference));
  RAISE EXCEPTION 'cross-owner write was accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'savings account details require an owned savings account' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM public.financial_accounts WHERE id='7e000000-0000-4000-8000-0000000000a1' AND opening_balance_centavos <> 0) THEN RAISE EXCEPTION 'interest reference changed the balance'; END IF;
END;
$$;
ROLLBACK;
