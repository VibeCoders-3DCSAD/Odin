BEGIN;

INSERT INTO auth.users (id) VALUES ('6e000000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claim.sub', '6e000000-0000-4000-8000-000000000001', true);
INSERT INTO public.categories (id, user_id, slug, label, description, is_system) VALUES
  ('6e000000-0000-4000-8000-0000000000c1', '6e000000-0000-4000-8000-000000000001', 'precision-food', 'Food', 'Food', false),
  ('6e000000-0000-4000-8000-0000000000c2', '6e000000-0000-4000-8000-000000000001', 'precision-transport', 'Transport', 'Transport', false),
  ('6e000000-0000-4000-8000-0000000000c3', '6e000000-0000-4000-8000-000000000001', 'precision-utilities', 'Utilities', 'Utilities', false);

DO $$
DECLARE
  v_month date := date_trunc('month', now() AT TIME ZONE 'Asia/Manila')::date;
  v_payload jsonb;
  v_result record;
BEGIN
  -- JS serializes 8717.78 * 100 as 871778.0000000001: as doubles these sum to exactly 2706000 (what the device and
  -- API accept), while an exact numeric sum exceeds the available funds by 1e-10.
  v_payload := jsonb_build_object(
    'period_start', v_month, 'period_end', (v_month + interval '1 month - 1 day')::date, 'status', 'accepted',
    'input_snapshot', jsonb_build_object(
      'forecast', jsonb_build_object('month', to_char(v_month, 'YYYY-MM'), 'totalAmountCentavos', 0, 'modelVersion', 'test-v1', 'generatedAt', now(), 'quality', 'FALLBACK', 'categoryForecasts', '[]'::jsonb),
      'restrictions', '{"allocations":[]}'::jsonb, 'obligations', '{"reservations":[]}'::jsonb,
      'debtRequirements', '{"reservations":[]}'::jsonb, 'savingsRequirements', '{"reservations":[]}'::jsonb, 'classification', '{"status":"unavailable"}'::jsonb),
    'recommendation', '{"availableFundsCentavos":2706000,"debtReservations":[],"savingsReservations":[],"allocations":[
      {"categoryId":"6e000000-0000-4000-8000-0000000000c1","allocationRule":"FLEXIBLE","allocatedAmountCentavos":1235705,"floorAmountCentavos":0},
      {"categoryId":"6e000000-0000-4000-8000-0000000000c2","allocationRule":"FLEXIBLE","allocatedAmountCentavos":598517,"floorAmountCentavos":0},
      {"categoryId":"6e000000-0000-4000-8000-0000000000c3","allocationRule":"FLEXIBLE","allocatedAmountCentavos":871778.0000000001,"floorAmountCentavos":0}]}'::jsonb);

  SELECT * INTO v_result FROM public.apply_financial_plan_sync_operation(gen_random_uuid(), 'device-1', 'financial_plans', '6e000000-0000-4000-8000-0000000000a1', 'create', NULL, '{}', v_payload);
  IF v_result.status <> 'applied' THEN RAISE EXCEPTION 'allocations the client summed within available funds must apply: %', v_result; END IF;

  BEGIN
    PERFORM public.apply_financial_plan_sync_operation(gen_random_uuid(), 'device-1', 'financial_plans', '6e000000-0000-4000-8000-0000000000a2', 'create', NULL, '{}',
      jsonb_set(v_payload, '{recommendation,availableFundsCentavos}', '2705999'));
    RAISE EXCEPTION 'allocations above available funds must be rejected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Financial Plan allocations exceed available funds' THEN RAISE; END IF;
  END;
END;
$$;

ROLLBACK;
