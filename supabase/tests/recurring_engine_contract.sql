BEGIN;

INSERT INTO auth.users (id) VALUES ('5a000000-0000-4000-8000-000000000001');
INSERT INTO public.financial_accounts (id, user_id, name, kind, opening_balance_centavos, current_balance_centavos) VALUES
 ('5a000000-0000-4000-8000-0000000000a1','5a000000-0000-4000-8000-000000000001','Contract source','bank',100000,100000),
 ('5a000000-0000-4000-8000-0000000000a2','5a000000-0000-4000-8000-000000000001','Contract destination','bank',0,0);
INSERT INTO public.categories (id,user_id,slug,label,description,is_system) VALUES ('5a000000-0000-4000-8000-0000000000c1','5a000000-0000-4000-8000-000000000001','contract-category','Contract category','Contract category',false);
INSERT INTO public.subcategories (id,user_id,category_id,kind,slug,label,description,is_system) VALUES
 ('5a000000-0000-4000-8000-0000000000e1','5a000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-0000000000c1','expense','contract-expense','Contract expense','Contract expense',false),
 ('5a000000-0000-4000-8000-0000000000e2','5a000000-0000-4000-8000-000000000001',NULL,'income','contract-income','Contract income','Contract income',false);
INSERT INTO public.recurring_transaction_templates (id,user_id,transaction_type,name,amount_centavos,subcategory_id,source_account_id,destination_account_id,frequency,starts_on,next_occurrence_date) VALUES
 ('5a000000-0000-4000-8000-0000000000b1','5a000000-0000-4000-8000-000000000001','expense','Expense contract',100,'5a000000-0000-4000-8000-0000000000e1','5a000000-0000-4000-8000-0000000000a1',NULL,'daily','2026-11-01','2026-11-01'),
 ('5a000000-0000-4000-8000-0000000000b2','5a000000-0000-4000-8000-000000000001','transfer','Transfer contract',100,NULL,'5a000000-0000-4000-8000-0000000000a1','5a000000-0000-4000-8000-0000000000a2','daily','2026-11-01','2026-11-01'),
 ('5a000000-0000-4000-8000-0000000000b3','5a000000-0000-4000-8000-000000000001','income','Standalone income contract',100,'5a000000-0000-4000-8000-0000000000e2',NULL,'5a000000-0000-4000-8000-0000000000a1','daily','2026-11-01','2026-11-01');
DO $$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count FROM odin.run_recurring_transaction_engine('2026-11-02',1,'5a000000-0000-4000-8000-000000000001') WHERE out_status='posted';
 IF v_count <> 1 THEN RAISE EXCEPTION 'limit must select one template and return its posted result, got %',v_count; END IF;
 SELECT count(*) INTO v_count FROM odin.run_recurring_transaction_engine('2026-11-02',200,'5a000000-0000-4000-8000-000000000001') WHERE out_status='posted';
 IF v_count <> 2 THEN RAISE EXCEPTION 'expense, transfer and standalone income must all post, got % remaining',v_count; END IF;
 SELECT count(*) INTO v_count FROM odin.run_recurring_transaction_engine('2026-11-03',200,'5a000000-0000-4000-8000-000000000001') WHERE out_status='posted';
 IF v_count <> 3 THEN RAISE EXCEPTION 'as_of must control the last posted date, got %',v_count; END IF;
 SELECT count(*) INTO v_count FROM odin.run_recurring_transaction_engine('2026-11-03',200,'5a000000-0000-4000-8000-000000000001');
 IF v_count <> 0 THEN RAISE EXCEPTION 'repeated engine runs must not post again'; END IF;
END;
$$;

ROLLBACK;
