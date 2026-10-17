BEGIN;

INSERT INTO auth.users (id) VALUES ('5c000000-0000-4000-8000-000000000001'), ('5c000000-0000-4000-8000-000000000002');
INSERT INTO public.financial_accounts (id, user_id, name, kind) VALUES
  ('5c000000-0000-4000-8000-0000000000a1', '5c000000-0000-4000-8000-000000000001', 'Wallet', 'cash'),
  ('5c000000-0000-4000-8000-0000000000a2', '5c000000-0000-4000-8000-000000000002', 'Other wallet', 'cash');
INSERT INTO public.categories (id, user_id, slug, label, description, is_system) VALUES
  ('5c000000-0000-4000-8000-0000000000d1', '5c000000-0000-4000-8000-000000000001', 'bills-test', 'Bills', 'Bills', false);
INSERT INTO public.subcategories (id, user_id, category_id, kind, slug, label, description, is_system) VALUES
  ('5c000000-0000-4000-8000-0000000000e1', '5c000000-0000-4000-8000-000000000001', '5c000000-0000-4000-8000-0000000000d1', 'expense', 'electricity-test', 'Electricity', 'Electricity', false);
INSERT INTO public.transactions (id, user_id, transaction_type, transaction_date, amount_centavos, source_account_id, subcategory_id)
VALUES ('5c000000-0000-4000-8000-0000000000f1', '5c000000-0000-4000-8000-000000000001', 'expense', '2026-11-05', 50000,
        '5c000000-0000-4000-8000-0000000000a1', '5c000000-0000-4000-8000-0000000000e1');

SELECT set_config('request.jwt.claim.sub', '5c000000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_sub uuid := '5c000000-0000-4000-8000-0000000000e1';
  v_payment uuid := '5c000000-0000-4000-8000-0000000000b1';
  v_result record;
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object('name', ' Meralco ', 'subcategory_id', v_sub, 'source_account_id', '5c000000-0000-4000-8000-0000000000a1',
    'amount_centavos', 234000, 'frequency', 'monthly', 'due_day_of_month', 5, 'starts_on', '2026-09-01');
  SELECT * INTO v_result FROM public.apply_scheduled_payment_sync_operation(gen_random_uuid(), 'device-1', 'scheduled_payments', v_payment, 'create', NULL, '{}', v_payload);
  IF v_result.status <> 'applied' OR (SELECT name FROM public.scheduled_payments WHERE id = v_payment) <> 'Meralco' THEN
    RAISE EXCEPTION 'creating a scheduled payment must apply and trim the name: %', v_result;
  END IF;

  SELECT * INTO v_result FROM public.apply_scheduled_payment_sync_operation(gen_random_uuid(), 'device-2', 'scheduled_payments', v_payment, 'create', NULL, '{}', v_payload);
  IF v_result.status <> 'duplicate' THEN RAISE EXCEPTION 'replaying an owned id must be a duplicate: %', v_result; END IF;

  BEGIN
    PERFORM public.apply_scheduled_payment_sync_operation(gen_random_uuid(), 'device-1', 'scheduled_payments', gen_random_uuid(), 'create', NULL, '{}',
      v_payload || jsonb_build_object('source_account_id', '5c000000-0000-4000-8000-0000000000a2'));
    RAISE EXCEPTION 'another user''s account must be rejected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'source account is not an accessible active account%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.apply_scheduled_payment_sync_operation(gen_random_uuid(), 'device-1', 'scheduled_payments', gen_random_uuid(), 'create', NULL, '{}',
      v_payload || jsonb_build_object('frequency', 'once', 'auto_post', true, 'auto_post_from', '2026-09-01'));
    RAISE EXCEPTION 'auto-post without a repeat must be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  SELECT * INTO v_result FROM public.apply_scheduled_payment_sync_operation(gen_random_uuid(), 'device-1', 'scheduled_payments', v_payment, 'update', 1, '{auto_post,auto_post_from}',
    jsonb_build_object('auto_post', true, 'auto_post_from', '2026-11-01'));
  IF v_result.status <> 'applied' OR v_result.current_version <> 2 OR NOT (SELECT auto_post FROM public.scheduled_payments WHERE id = v_payment) THEN
    RAISE EXCEPTION 'turning on auto-post must apply: %', v_result;
  END IF;

  SELECT * INTO v_result FROM public.apply_scheduled_payment_sync_operation(gen_random_uuid(), 'device-1', 'scheduled_payments', v_payment, 'update', 1, '{name}', '{"name":"Stale"}');
  IF v_result.status <> 'conflict' THEN RAISE EXCEPTION 'a stale base version must conflict: %', v_result; END IF;

  SELECT * INTO v_result FROM public.apply_scheduled_payment_sync_operation(gen_random_uuid(), 'device-1', 'scheduled_payment_records', '5c000000-0000-4000-8000-0000000000c1', 'create', NULL, '{}',
    jsonb_build_object('scheduled_payment_id', v_payment, 'transaction_id', '5c000000-0000-4000-8000-0000000000f1', 'occurrence_date', '2026-11-05',
      'payment_date', '2026-11-05', 'amount_centavos', 50000, 'source', 'manual'));
  IF v_result.status <> 'applied' THEN RAISE EXCEPTION 'recording a payment must apply: %', v_result; END IF;

  BEGIN
    PERFORM public.apply_scheduled_payment_sync_operation(gen_random_uuid(), 'device-1', 'scheduled_payment_records', '5c000000-0000-4000-8000-0000000000c1', 'update', 1, '{notes}', '{"notes":"x"}');
    RAISE EXCEPTION 'payment records must not be updated';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'payment records cannot be updated%' THEN RAISE; END IF;
  END;

  SELECT * INTO v_result FROM public.apply_scheduled_payment_sync_operation(gen_random_uuid(), 'device-1', 'scheduled_payments', v_payment, 'update', 2, '{status}', '{"status":"archived"}');
  IF v_result.status <> 'applied' THEN RAISE EXCEPTION 'archiving must apply: %', v_result; END IF;
  BEGIN
    PERFORM public.apply_scheduled_payment_sync_operation(gen_random_uuid(), 'device-1', 'scheduled_payment_records', gen_random_uuid(), 'create', NULL, '{}',
      jsonb_build_object('scheduled_payment_id', v_payment, 'transaction_id', '5c000000-0000-4000-8000-0000000000f1', 'occurrence_date', '2026-12-05',
        'payment_date', '2026-12-05', 'amount_centavos', 100));
    RAISE EXCEPTION 'an archived scheduled payment must not take payments';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'payment requires an active scheduled payment%' THEN RAISE; END IF;
  END;

  SELECT * INTO v_result FROM public.apply_scheduled_payment_sync_operation(gen_random_uuid(), 'device-1', 'scheduled_payments', v_payment, 'delete', 3, '{}', '{}');
  IF v_result.status <> 'applied' OR NOT (SELECT deleted FROM public.scheduled_payments WHERE id = v_payment)
     OR (SELECT deleted FROM public.scheduled_payment_records WHERE id = '5c000000-0000-4000-8000-0000000000c1') THEN
    RAISE EXCEPTION 'deleting a scheduled payment must keep its payment history: %', v_result;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '5c000000-0000-4000-8000-000000000002', true);
  BEGIN
    PERFORM public.apply_scheduled_payment_sync_operation(gen_random_uuid(), 'device-9', 'scheduled_payment_records', '5c000000-0000-4000-8000-0000000000c1', 'delete', 1, '{}', '{}');
    RAISE EXCEPTION 'another user must not delete this payment record';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'payment record not found or inaccessible%' THEN RAISE; END IF;
  END;
END;
$$;

ROLLBACK;
