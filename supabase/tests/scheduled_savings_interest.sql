-- Interest posting was retired. Old schedules and callers must never create credits.
BEGIN;
INSERT INTO auth.users(id) VALUES('8e000000-0000-4000-8000-000000000001');
INSERT INTO public.financial_accounts(id,user_id,name,kind,status,opening_balance_centavos,current_balance_centavos,opened_on)
VALUES('8e000000-0000-4000-8000-0000000000a1','8e000000-0000-4000-8000-000000000001','Legacy scheduled interest test','savings','active',10000,10000,'2026-01-01');
INSERT INTO public.savings_account_details(account_id,user_id,account_type,interest_rate_bps,interest_reference)
VALUES('8e000000-0000-4000-8000-0000000000a1','8e000000-0000-4000-8000-000000000001','personal_savings',400,
'{"balanceBasis":"daily_balance","method":"compound","rateStructure":"fixed","schedule":{"startsOn":"2026-01-01","frequency":"daily","withholdingTaxBps":2000,"tiers":[]}}');
INSERT INTO public.subcategories(id,user_id,slug,kind,label,description,is_system)
VALUES('8e000000-0000-4000-8000-0000000000b1','8e000000-0000-4000-8000-000000000001','manual-interest-test','income','Bank interest','Manual interest test',false);
INSERT INTO public.transactions(id,user_id,transaction_type,status,entry_source,transaction_date,posted_at,amount_centavos,subcategory_id,destination_account_id,client_mutation_id) VALUES
('8e000000-0000-4000-8000-0000000000c1','8e000000-0000-4000-8000-000000000001','income','posted','manual','2026-02-01',now(),50,'8e000000-0000-4000-8000-0000000000b1','8e000000-0000-4000-8000-0000000000a1',NULL),
('8e000000-0000-4000-8000-0000000000c2','8e000000-0000-4000-8000-000000000001','income','posted','recurring','2026-01-02',now(),100,'8e000000-0000-4000-8000-0000000000b1','8e000000-0000-4000-8000-0000000000a1','savings-interest:8e000000-0000-4000-8000-0000000000a1:2026-01-01');
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='post-due-savings-interest') THEN RAISE EXCEPTION 'automatic savings interest job still exists'; END IF;
 IF private.post_due_savings_interest('2027-01-01') <> 0 OR private.post_due_savings_interest('2027-01-01') <> 0 THEN RAISE EXCEPTION 'retired engine returned postings'; END IF;
 IF (SELECT count(*) FROM public.transactions WHERE destination_account_id='8e000000-0000-4000-8000-0000000000a1') <> 2 OR (SELECT sum(amount_centavos) FROM public.transactions WHERE destination_account_id='8e000000-0000-4000-8000-0000000000a1') <> 150 THEN RAISE EXCEPTION 'retired engine changed manual or historical interest'; END IF;
 IF EXISTS(SELECT 1 FROM private.savings_interest_progress WHERE account_id='8e000000-0000-4000-8000-0000000000a1') THEN RAISE EXCEPTION 'legacy schedule advanced automatic progress'; END IF;
 IF has_function_privilege('authenticated','private.post_due_savings_interest(date)','EXECUTE') THEN RAISE EXCEPTION 'retired engine exposed to users'; END IF;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
DO $$ BEGIN
 IF (SELECT current_balance_centavos FROM public.financial_accounts WHERE id='8e000000-0000-4000-8000-0000000000a1') <> 10150 THEN RAISE EXCEPTION 'removing automation changed the balance'; END IF;
END $$;
ROLLBACK;
