BEGIN;
INSERT INTO auth.users(id) VALUES('8f000000-0000-4000-8000-000000000001');
INSERT INTO public.financial_accounts(id,user_id,name,kind,status,opening_balance_centavos)
VALUES('8f000000-0000-4000-8000-0000000000a1','8f000000-0000-4000-8000-000000000001','Fixed configuration test','savings','active',10000);
SELECT set_config('request.jwt.claim.sub','8f000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE
 c jsonb := '{"version":1,"calculationFrequency":"daily","creditFrequency":"custom","creditIntervalDays":14,"postingMode":"period_end","postingDay":null,"postingDate":null,"startsOn":"2026-01-01","startingBalanceCentavos":10000,"averagingPeriod":"calendar_month","averagingIntervalDays":null,"minimumQualifyingBalanceCentavos":null,"maximumInterestBearingBalanceCentavos":null,"dayCountBasis":"actual_365","taxEnabled":true,"withholdingTaxBps":2000,"autoProject":false,"stoppingPolicy":"preserve","showBreakdown":true,"rateHistory":[{"effectiveOn":"2026-01-01","rateBps":400}]}';
 ref jsonb; invalid jsonb; result record;
BEGIN
 IF NOT private.is_valid_fixed_interest_configuration(c) THEN RAISE EXCEPTION 'valid configuration rejected'; END IF;
 ref := jsonb_build_object('balanceBasis','average_daily_balance','method','compound','rateStructure','fixed','notes',null,'configuration',c);
 SELECT * INTO result FROM public.apply_sync_operation(gen_random_uuid(),'fixed-interest-test','savings_account_details','8f000000-0000-4000-8000-0000000000a1','create',NULL,
 ARRAY['account_type','interest_rate_bps','interest_reference'],jsonb_build_object('account_type','personal_savings','interest_rate_bps',400,'interest_reference',ref));
 IF result.status <> 'applied' THEN RAISE EXCEPTION 'configuration create failed %',result; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.savings_account_details WHERE account_id='8f000000-0000-4000-8000-0000000000a1' AND interest_reference=ref) THEN RAISE EXCEPTION 'configuration did not persist'; END IF;
 IF private.post_due_savings_interest('2026-03-01') <> 0 OR EXISTS(SELECT 1 FROM private.savings_interest_progress WHERE account_id='8f000000-0000-4000-8000-0000000000a1') THEN RAISE EXCEPTION 'new configuration activated legacy direct-credit engine'; END IF;
 FOREACH invalid IN ARRAY ARRAY[
  c - 'creditFrequency', c || '{"unknown":true}', c || '{"creditIntervalDays":0}', c || '{"startsOn":"2026-02-30"}',
  c || '{"withholdingTaxBps":null}', c || '{"withholdingTaxBps":10001}', c || '{"autoProject":"true"}', c || '{"autoProject":true}',
  c || '{"minimumQualifyingBalanceCentavos":10000,"maximumInterestBearingBalanceCentavos":100}',
  c || '{"rateHistory":[{"effectiveOn":"2026-01-01","rateBps":400},{"effectiveOn":"2026-01-01","rateBps":500}]}'
 ] LOOP
  IF private.is_valid_fixed_interest_configuration(invalid) THEN RAISE EXCEPTION 'invalid configuration accepted %',invalid; END IF;
 END LOOP;
 IF private.is_valid_savings_interest_reference(ref || '{"rateStructure":"tiered"}') THEN RAISE EXCEPTION 'tiered configuration accepted'; END IF;
 IF private.is_valid_savings_interest_reference(ref || '{"schedule":{"startsOn":"2026-01-01","frequency":"daily"}}') THEN RAISE EXCEPTION 'legacy schedule allowed with new configuration'; END IF;
 ref := jsonb_set(jsonb_set(ref,'{method}','"none"'),'{configuration,autoProject}','false');
 SELECT * INTO result FROM public.apply_sync_operation(gen_random_uuid(),'fixed-interest-test','savings_account_details','8f000000-0000-4000-8000-0000000000a1','update',1,
 ARRAY['interest_rate_bps','interest_reference'],jsonb_build_object('interest_rate_bps',0,'interest_reference',ref));
 IF result.status <> 'applied' THEN RAISE EXCEPTION 'None update failed %',result; END IF;
 IF EXISTS(SELECT 1 FROM public.transactions WHERE destination_account_id='8f000000-0000-4000-8000-0000000000a1') THEN RAISE EXCEPTION 'form configuration created an actual transaction'; END IF;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
