BEGIN;

INSERT INTO auth.users (id) VALUES ('5f000000-0000-4000-8000-000000000001');
INSERT INTO public.financial_accounts (id, user_id, name, kind, opening_balance_centavos, current_balance_centavos) VALUES
  ('5f000000-0000-4000-8000-0000000000a1', '5f000000-0000-4000-8000-000000000001', 'Payroll', 'bank', 0, 0);
INSERT INTO public.subcategories (id, user_id, category_id, kind, slug, label, description, is_system) VALUES
  ('5f000000-0000-4000-8000-0000000000e1', '5f000000-0000-4000-8000-000000000001', NULL, 'income', 'salary-auto', 'Salary auto test', 'Salary auto test', false);

INSERT INTO public.recurring_transaction_templates (id, user_id, transaction_type, name, amount_centavos, subcategory_id, destination_account_id, frequency, day_of_month, second_day_of_month, day_of_week, starts_on) VALUES
  -- Twice a month on the 15th and 30th.
  ('5f000000-0000-4000-8000-0000000000b1', '5f000000-0000-4000-8000-000000000001', 'income', 'Salary', 2500000, '5f000000-0000-4000-8000-0000000000e1', '5f000000-0000-4000-8000-0000000000a1', 'semi_monthly', 15, 30, NULL, '2026-11-01'),
  -- Daily, but its income source is paused.
  ('5f000000-0000-4000-8000-0000000000b2', '5f000000-0000-4000-8000-000000000001', 'income', 'Paused', 10000, '5f000000-0000-4000-8000-0000000000e1', '5f000000-0000-4000-8000-0000000000a1', 'daily', NULL, NULL, NULL, '2026-11-01'),
  -- Weekly on Fridays; a legacy post exists for Nov 6.
  ('5f000000-0000-4000-8000-0000000000b3', '5f000000-0000-4000-8000-000000000001', 'income', 'Tips', 50000, '5f000000-0000-4000-8000-0000000000e1', '5f000000-0000-4000-8000-0000000000a1', 'weekly', NULL, NULL, 5, '2026-11-01'),
  -- Not linked to any income source.
  ('5f000000-0000-4000-8000-0000000000b4', '5f000000-0000-4000-8000-000000000001', 'income', 'Orphan', 10000, '5f000000-0000-4000-8000-0000000000e1', '5f000000-0000-4000-8000-0000000000a1', 'daily', NULL, NULL, NULL, '2026-11-01');
INSERT INTO public.income_sources (id, user_id, name, frequency, expected_amount_centavos, payday_day_of_month, payday_second_day_of_month, payday_day_of_week, recurring_template_id, destination_account_id, subcategory_id, is_active) VALUES
  ('5f000000-0000-4000-8000-0000000000c1', '5f000000-0000-4000-8000-000000000001', 'Salary', 'semi_monthly', 2500000, 15, 30, NULL, '5f000000-0000-4000-8000-0000000000b1', '5f000000-0000-4000-8000-0000000000a1', '5f000000-0000-4000-8000-0000000000e1', true),
  ('5f000000-0000-4000-8000-0000000000c2', '5f000000-0000-4000-8000-000000000001', 'Paused', 'daily', 10000, NULL, NULL, NULL, '5f000000-0000-4000-8000-0000000000b2', '5f000000-0000-4000-8000-0000000000a1', '5f000000-0000-4000-8000-0000000000e1', false),
  ('5f000000-0000-4000-8000-0000000000c3', '5f000000-0000-4000-8000-000000000001', 'Tips', 'weekly', 50000, NULL, NULL, 5, '5f000000-0000-4000-8000-0000000000b3', '5f000000-0000-4000-8000-0000000000a1', '5f000000-0000-4000-8000-0000000000e1', true);

-- The retired engine already posted Tips for Nov 6, with random ids.
INSERT INTO public.transactions (id, user_id, transaction_type, transaction_date, amount_centavos, destination_account_id, subcategory_id, client_mutation_id)
VALUES ('5f000000-0000-4000-8000-0000000000f1', '5f000000-0000-4000-8000-000000000001', 'income', '2026-11-06', 50000, '5f000000-0000-4000-8000-0000000000a1', '5f000000-0000-4000-8000-0000000000e1',
        'recurring:5f000000-0000-4000-8000-0000000000b3:2026-11-06');
INSERT INTO public.recurring_transaction_occurrences (recurring_template_id, user_id, scheduled_date, status, generated_transaction_id)
VALUES ('5f000000-0000-4000-8000-0000000000b3', '5f000000-0000-4000-8000-000000000001', '2026-11-06', 'posted', '5f000000-0000-4000-8000-0000000000f1');

DO $$
DECLARE
  v_salary uuid := '5f000000-0000-4000-8000-0000000000b1';
  v_tips uuid := '5f000000-0000-4000-8000-0000000000b3';
  v_posted integer;
  v_result record;
BEGIN
  -- Ids must match recurringIncomePostIds on the device (apps/app/local-db/__tests__/uuid.test.ts).
  IF private.recurring_income_post_id('5c000000-0000-4000-8000-0000000000b1', '2026-11-15', 'transaction') <> 'c6ed60ac-cf57-5d72-9331-1a8a7fecbf61'
     OR private.recurring_income_post_id('5c000000-0000-4000-8000-0000000000b1', '2026-11-15', 'occurrence') <> '9ba7c0c6-a15b-57f4-b4fc-5cbd0c5de261' THEN
    RAISE EXCEPTION 'server income post ids must match the device';
  END IF;

  -- Salary: Nov 15 and 30. Tips: Nov 13, 20 and 27 (Nov 6 was posted by the retired engine). Paused and orphan: nothing.
  v_posted := private.post_due_recurring_income('2026-11-30');
  IF v_posted <> 5 THEN RAISE EXCEPTION 'the first run must post 5 paydays, posted %', v_posted; END IF;
  IF (SELECT array_agg(transaction_date ORDER BY transaction_date) FROM public.transactions WHERE merchant_name = 'Salary' AND transaction_type = 'income' AND amount_centavos = 2500000)
     <> ARRAY['2026-11-15', '2026-11-30']::date[] THEN
    RAISE EXCEPTION 'salary must post on both paydays, named after the income source';
  END IF;
  IF (SELECT count(*) FROM public.transactions WHERE destination_account_id = '5f000000-0000-4000-8000-0000000000a1' AND transaction_date = '2026-11-06') <> 1 THEN
    RAISE EXCEPTION 'a payday the retired engine posted must not post again';
  END IF;
  IF EXISTS (SELECT 1 FROM public.transactions WHERE merchant_name IN ('Paused', 'Orphan')) THEN
    RAISE EXCEPTION 'paused and unlinked templates must not post';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.recurring_transaction_occurrences
     WHERE id = private.recurring_income_post_id(v_salary, '2026-11-15', 'occurrence') AND status = 'posted'
       AND generated_transaction_id = private.recurring_income_post_id(v_salary, '2026-11-15', 'transaction')
  ) THEN RAISE EXCEPTION 'posts must use the derived ids'; END IF;

  SET CONSTRAINTS ALL IMMEDIATE;
  IF (SELECT current_balance_centavos FROM public.financial_accounts WHERE id = '5f000000-0000-4000-8000-0000000000a1') <> 50000 + 2 * 2500000 + 3 * 50000 THEN
    RAISE EXCEPTION 'posts must raise the account balance';
  END IF;
  SET CONSTRAINTS ALL DEFERRED;

  v_posted := private.post_due_recurring_income('2026-11-30');
  IF v_posted <> 0 THEN RAISE EXCEPTION 'a second run must post nothing, posted %', v_posted; END IF;

  -- The API entry point shares ids with cron and devices; it must not double-post.
  PERFORM odin.run_recurring_transaction_engine('2026-11-30', 200, '5f000000-0000-4000-8000-000000000001');
  IF (SELECT count(*) FROM public.transactions WHERE merchant_name = 'Salary') <> 2 THEN RAISE EXCEPTION 'the old entry point must not double-post'; END IF;

  -- A device posted Dec 4 offline and synced its transaction first: the server must not post it again.
  INSERT INTO public.transactions (id, user_id, transaction_type, transaction_date, amount_centavos, destination_account_id, subcategory_id, merchant_name)
  VALUES (private.recurring_income_post_id(v_tips, '2026-12-04', 'transaction'), '5f000000-0000-4000-8000-000000000001', 'income', '2026-12-04', 50000,
          '5f000000-0000-4000-8000-0000000000a1', '5f000000-0000-4000-8000-0000000000e1', 'Tips');
  v_posted := private.post_due_recurring_income('2026-12-04');
  IF v_posted <> 0 THEN RAISE EXCEPTION 'a device-posted payday must not post again, posted %', v_posted; END IF;

  PERFORM set_config('request.jwt.claim.sub', '5f000000-0000-4000-8000-000000000001', true);
  -- The device then pushes its occurrence: applied, and stored as posted.
  SELECT * INTO v_result FROM public.apply_sync_operation(gen_random_uuid(), 'device-1', 'recurring_transaction_occurrences',
    private.recurring_income_post_id(v_tips, '2026-12-04', 'occurrence'), 'create', NULL, '{}',
    jsonb_build_object('recurring_template_id', v_tips, 'scheduled_date', '2026-12-04', 'generated_transaction_id', private.recurring_income_post_id(v_tips, '2026-12-04', 'transaction')));
  IF v_result.status <> 'applied' OR (SELECT status FROM public.recurring_transaction_occurrences WHERE id = private.recurring_income_post_id(v_tips, '2026-12-04', 'occurrence')) <> 'posted' THEN
    RAISE EXCEPTION 'a device occurrence must apply as posted: %', v_result;
  END IF;
  -- Another device pushes a payday the server already posted: a duplicate, not an error.
  SELECT * INTO v_result FROM public.apply_sync_operation(gen_random_uuid(), 'device-2', 'recurring_transaction_occurrences',
    private.recurring_income_post_id(v_salary, '2026-11-15', 'occurrence'), 'create', NULL, '{}',
    jsonb_build_object('recurring_template_id', v_salary, 'scheduled_date', '2026-11-15', 'generated_transaction_id', private.recurring_income_post_id(v_salary, '2026-11-15', 'transaction')));
  IF v_result.status <> 'duplicate' THEN RAISE EXCEPTION 'pushing a server-posted payday must be a duplicate: %', v_result; END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'post-due-recurring-income' AND schedule = '*/5 * * * *') THEN
    RAISE EXCEPTION 'the income job must run every 5 minutes';
  END IF;
END;
$$;

ROLLBACK;
