BEGIN;

INSERT INTO auth.users (id) VALUES ('6d000000-0000-4000-8000-000000000001'), ('6d000000-0000-4000-8000-000000000002');
SELECT set_config('request.jwt.claim.sub', '6d000000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_plan uuid := '6d000000-0000-4000-8000-0000000000a1';
  v_operation uuid := gen_random_uuid();
  v_month date := date_trunc('month', now() AT TIME ZONE 'Asia/Manila')::date;
  v_snapshot jsonb;
  v_recommendation jsonb;
  v_payload jsonb;
  v_result record;
BEGIN
  v_snapshot := jsonb_build_object(
    'plannedAmountCentavos', 100000,
    'forecast', jsonb_build_object('month', to_char(v_month, 'YYYY-MM'), 'totalAmountCentavos', 0, 'modelVersion', 'test-v1', 'generatedAt', now(), 'quality', 'FALLBACK', 'categoryForecasts', '[]'::jsonb),
    'restrictions', '{"allocations":[]}'::jsonb,
    'obligations', jsonb_build_object('reservations', jsonb_build_array(jsonb_build_object('scheduledPaymentId', gen_random_uuid(), 'label', 'Rent at acceptance', 'amountCentavos', 30000, 'dueDate', v_month + 19))),
    'debtRequirements', '{"reservations":[]}'::jsonb, 'savingsRequirements', '{"reservations":[]}'::jsonb, 'classification', '{"status":"unavailable"}'::jsonb
  );
  v_recommendation := '{"availableFundsCentavos":70000,"allocations":[],"debtReservations":[],"savingsReservations":[]}'::jsonb;
  v_payload := jsonb_build_object('period_start', v_month, 'period_end', (v_month + interval '1 month - 1 day')::date, 'status', 'accepted', 'input_snapshot', v_snapshot, 'recommendation', v_recommendation);

  SELECT * INTO v_result FROM public.apply_financial_plan_sync_operation(v_operation, 'device-1', 'financial_plans', v_plan, 'create', NULL, '{}', v_payload);
  IF v_result.status <> 'applied' OR NOT EXISTS (
    SELECT 1 FROM public.financial_plans WHERE id = v_plan AND input_snapshot_json = v_snapshot AND recommendation_json = v_recommendation
  ) THEN RAISE EXCEPTION 'accepted plan documents must be persisted: %', v_result; END IF;

  -- A replay must return the original result without replacing the accepted documents.
  PERFORM public.apply_financial_plan_sync_operation(v_operation, 'device-1', 'financial_plans', v_plan, 'create', NULL, '{}',
    v_payload || jsonb_build_object('input_snapshot', jsonb_set(v_snapshot, '{obligations}', '{"reservations":[]}'::jsonb)));
  IF (SELECT input_snapshot_json FROM public.financial_plans WHERE id = v_plan) <> v_snapshot THEN
    RAISE EXCEPTION 'replayed operations must not overwrite accepted obligations';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '6d000000-0000-4000-8000-000000000002', true);
  BEGIN
    PERFORM public.apply_financial_plan_sync_operation(gen_random_uuid(), 'other-device', 'financial_plans', v_plan, 'delete', 1, '{}', '{}');
    RAISE EXCEPTION 'another user must not reset the accepted plan';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Financial Plan is not accessible' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', '6d000000-0000-4000-8000-000000000001', true);
  SELECT * INTO v_result FROM public.apply_financial_plan_sync_operation(gen_random_uuid(), 'device-1', 'financial_plans', v_plan, 'delete', 1, '{}', '{}');
  IF v_result.status <> 'applied' OR NOT EXISTS (
    SELECT 1 FROM public.financial_plans WHERE id = v_plan AND deleted = true AND input_snapshot_json IS NULL AND recommendation_json IS NULL
  ) THEN RAISE EXCEPTION 'reset must clear the documents: %', v_result; END IF;

  PERFORM public.apply_financial_plan_sync_operation(v_operation, 'device-1', 'financial_plans', v_plan, 'create', NULL, '{}', v_payload);
  IF EXISTS (SELECT 1 FROM public.financial_plans WHERE id = v_plan AND input_snapshot_json IS NOT NULL) THEN
    RAISE EXCEPTION 'replaying a create after reset must not restore deleted commitments';
  END IF;
END;
$$;

ROLLBACK;
