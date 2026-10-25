-- Exercise the same public RPC used by sync/push; all fixtures roll back.
BEGIN;

INSERT INTO auth.users (id) VALUES
  ('ae000000-0000-4000-8000-000000000001'),
  ('ae000000-0000-4000-8000-000000000002');
INSERT INTO public.financial_accounts (id, user_id, name, kind) VALUES
  ('ae000000-0000-4000-8000-0000000000a1', 'ae000000-0000-4000-8000-000000000001', 'Anomaly test wallet', 'cash');
INSERT INTO public.categories (id, user_id, slug, label, description, is_system) VALUES
  ('ae000000-0000-4000-8000-0000000000c1', 'ae000000-0000-4000-8000-000000000001', 'anomaly-sync-test', 'Test', 'Test', false);
INSERT INTO public.subcategories (id, user_id, category_id, kind, slug, label, description, is_system) VALUES
  ('ae000000-0000-4000-8000-0000000000d1', 'ae000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-0000000000c1', 'expense', 'anomaly-sync-test', 'Test', 'Test', false);
INSERT INTO public.transactions (id, user_id, transaction_type, transaction_date, amount_centavos, source_account_id, subcategory_id) VALUES
  ('ae000000-0000-4000-8000-0000000000b1', 'ae000000-0000-4000-8000-000000000001', 'expense', '2026-10-19', 100000, 'ae000000-0000-4000-8000-0000000000a1', 'ae000000-0000-4000-8000-0000000000d1'),
  ('ae000000-0000-4000-8000-0000000000b2', 'ae000000-0000-4000-8000-000000000001', 'expense', '2026-06-10', 3000000, 'ae000000-0000-4000-8000-0000000000a1', 'ae000000-0000-4000-8000-0000000000d1');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'ae000000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_id uuid := 'ae000000-0000-4000-8000-0000000000e1';
  v_yearly_id uuid := 'ae000000-0000-4000-8000-0000000000e2';
  v_operation uuid := gen_random_uuid();
  v_confirmation_operation uuid := gen_random_uuid();
  v_result record;
  v_payload jsonb := '{"transaction_id":"ae000000-0000-4000-8000-0000000000b1","subcategory_id":"ae000000-0000-4000-8000-0000000000d1","amount_centavos":100000,"usable_history_count":6,"usual_spending_centavos":12500,"lower_bound_centavos":7500,"upper_bound_centavos":20000,"severity":1.2,"model_version":"personal-transaction-iqr-local-v1","evaluated_at":"2026-10-19T12:00:00Z"}';
BEGIN
  SELECT * INTO v_result FROM public.apply_sync_operation(v_operation, 'anomaly-test', 'anomaly_evaluations', v_id, 'create', NULL, '{}', v_payload);
  IF v_result.status IS DISTINCT FROM 'applied' OR v_result.current_version IS DISTINCT FROM 1
    OR NOT EXISTS (SELECT 1 FROM public.anomaly_evaluations WHERE id = v_id AND amount_centavos = 100000 AND history_days = 6 AND raw_anomaly_score = 1.2 AND feature_vector->>'usual_spending_centavos' = '12500') THEN
    RAISE EXCEPTION 'local anomaly evaluation creation must persist: %', v_result;
  END IF;

  SELECT * INTO v_result FROM public.apply_sync_operation(v_operation, 'anomaly-test', 'anomaly_evaluations', v_id, 'create', NULL, '{}', v_payload);
  IF v_result.status IS DISTINCT FROM 'duplicate' THEN RAISE EXCEPTION 'create replay must be duplicate: %', v_result; END IF;

  SELECT * INTO v_result FROM public.apply_sync_operation(v_confirmation_operation, 'anomaly-test', 'anomaly_evaluations', v_id, 'update', 1, '{confirmed_recurring_at}', '{"confirmed_recurring_at":"2026-10-19T13:00:00Z"}');
  IF v_result.status IS DISTINCT FROM 'applied' OR v_result.current_version IS DISTINCT FROM 2
    OR NOT EXISTS (SELECT 1 FROM public.anomaly_evaluations WHERE id = v_id AND confirmed_recurring_at = '2026-10-19T13:00:00Z'::timestamptz AND recurrence = 'frequent' AND raw_anomaly_score = 1.2) THEN
    RAISE EXCEPTION 'recurring confirmation must persist without changing scores: %', v_result;
  END IF;

  SELECT * INTO v_result FROM public.apply_sync_operation(v_confirmation_operation, 'anomaly-test', 'anomaly_evaluations', v_id, 'update', 1, '{confirmed_recurring_at}', '{"confirmed_recurring_at":"2026-10-19T13:00:00Z"}');
  IF v_result.status IS DISTINCT FROM 'duplicate' OR (SELECT version FROM public.anomaly_evaluations WHERE id = v_id) <> 2 THEN
    RAISE EXCEPTION 'confirmation replay must not increment the version: %', v_result;
  END IF;

  SELECT * INTO v_result FROM public.apply_sync_operation(gen_random_uuid(), 'anomaly-test', 'anomaly_evaluations', v_id, 'update', 1, '{confirmed_recurring_at}', '{"confirmed_recurring_at":"2026-10-19T14:00:00Z"}');
  IF v_result.status IS DISTINCT FROM 'conflict' OR v_result.current_version IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'stale confirmation must conflict: %', v_result;
  END IF;

  -- The yearly answer: no frequent confirmation, and a later answer cannot replace it.
  SELECT * INTO v_result FROM public.apply_sync_operation(gen_random_uuid(), 'anomaly-test', 'anomaly_evaluations', v_yearly_id, 'create', NULL, '{}',
    v_payload || '{"transaction_id":"ae000000-0000-4000-8000-0000000000b2","amount_centavos":3000000}');
  IF v_result.status IS DISTINCT FROM 'applied' THEN RAISE EXCEPTION 'yearly evaluation creation must persist: %', v_result; END IF;
  BEGIN
    PERFORM public.apply_sync_operation(gen_random_uuid(), 'anomaly-test', 'anomaly_evaluations', v_yearly_id, 'update', 1, '{recurrence,confirmed_recurring_at}', '{"recurrence":"yearly","confirmed_recurring_at":"2026-10-19T13:00:00Z"}');
    RAISE EXCEPTION 'yearly answer with a frequent confirmation unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid anomaly evaluation update' THEN RAISE; END IF;
  END;
  SELECT * INTO v_result FROM public.apply_sync_operation(gen_random_uuid(), 'anomaly-test', 'anomaly_evaluations', v_yearly_id, 'update', 1, '{recurrence}', '{"recurrence":"yearly"}');
  IF v_result.status IS DISTINCT FROM 'applied'
    OR NOT EXISTS (SELECT 1 FROM public.anomaly_evaluations WHERE id = v_yearly_id AND recurrence = 'yearly' AND confirmed_recurring_at IS NULL) THEN
    RAISE EXCEPTION 'yearly answer must persist without a frequent confirmation: %', v_result;
  END IF;
  SELECT * INTO v_result FROM public.apply_sync_operation(gen_random_uuid(), 'anomaly-test', 'anomaly_evaluations', v_yearly_id, 'update', 2, '{recurrence,confirmed_recurring_at}', '{"recurrence":"frequent","confirmed_recurring_at":"2026-10-20T13:00:00Z"}');
  IF NOT EXISTS (SELECT 1 FROM public.anomaly_evaluations WHERE id = v_yearly_id AND recurrence = 'yearly' AND confirmed_recurring_at IS NULL) THEN
    RAISE EXCEPTION 'a later answer must not replace the first: %', v_result;
  END IF;

  BEGIN
    PERFORM public.apply_sync_operation(gen_random_uuid(), 'anomaly-test', 'anomaly_evaluations', v_id, 'update', 2, '{severity}', '{"severity":2}');
    RAISE EXCEPTION 'score mutation unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid anomaly evaluation update' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', 'ae000000-0000-4000-8000-000000000002', true);
  BEGIN
    PERFORM public.apply_sync_operation(gen_random_uuid(), 'anomaly-test', 'anomaly_evaluations', gen_random_uuid(), 'create', NULL, '{}', v_payload);
    RAISE EXCEPTION 'foreign transaction unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'transaction is not accessible' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.apply_sync_operation(gen_random_uuid(), 'anomaly-test', 'anomaly_evaluations', v_id, 'update', 2, '{confirmed_recurring_at}', '{"confirmed_recurring_at":"2026-10-19T14:00:00Z"}');
    RAISE EXCEPTION 'foreign evaluation unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'anomaly evaluation is not accessible' THEN RAISE; END IF;
  END;
END;
$$;

ROLLBACK;
