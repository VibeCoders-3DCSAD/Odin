CREATE TABLE IF NOT EXISTS public.financial_plans (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL CHECK (status = 'accepted'),
  input_snapshot_json jsonb NOT NULL,
  recommendation_json jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  CHECK (date_trunc('month', period_start)::date = period_start),
  CHECK (period_end = (date_trunc('month', period_start) + interval '1 month - 1 day')::date)
);
CREATE INDEX IF NOT EXISTS financial_plans_user_period_idx
  ON public.financial_plans(user_id, period_start DESC) WHERE deleted = false;

ALTER TABLE public.financial_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_plans_user_select ON public.financial_plans
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.apply_financial_plan_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_next_month date := date_trunc('month', (now() AT TIME ZONE 'Asia/Manila') + interval '1 month')::date;
  v_existing_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity <> 'financial_plans' OR p_operation_type <> 'create' THEN RAISE EXCEPTION 'Financial Plans are immutable create-only records'; END IF;
  SELECT result INTO v_existing_result FROM applied_operations WHERE operation_id = p_operation_id AND user_id = v_user_id;
  IF v_existing_result IS NOT NULL THEN
    RETURN QUERY SELECT COALESCE(v_existing_result->>'status', 'duplicate'), NULLIF(v_existing_result->>'reason', ''), (v_existing_result->>'current_version')::integer, NULL::text[];
    RETURN;
  END IF;
  IF p_payload->>'status' <> 'accepted' THEN RAISE EXCEPTION 'only accepted Financial Plans can be created'; END IF;
  IF (p_payload->>'period_start')::date <> v_next_month OR (p_payload->>'period_end')::date <> (v_next_month + interval '1 month - 1 day')::date THEN RAISE EXCEPTION 'Financial Plans can only cover the next calendar month'; END IF;
  IF jsonb_typeof(p_payload->'input_snapshot') <> 'object' OR jsonb_typeof(p_payload->'recommendation') <> 'object' THEN RAISE EXCEPTION 'Financial Plan documents must be objects'; END IF;
  IF NOT (p_payload->'input_snapshot' ?& ARRAY['forecast', 'restrictions', 'obligations', 'debtRequirements', 'savingsRequirements', 'classification']) THEN RAISE EXCEPTION 'Financial Plan input snapshot is incomplete'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['forecast', 'restrictions', 'obligations', 'debtRequirements', 'savingsRequirements', 'classification']) AS key WHERE jsonb_typeof(p_payload->'input_snapshot'->key) <> 'object' OR p_payload->'input_snapshot'->key = '{}'::jsonb) THEN RAISE EXCEPTION 'Financial Plan input snapshot is invalid'; END IF;
  IF jsonb_typeof(p_payload->'recommendation'->'allocations') <> 'array' OR jsonb_typeof(p_payload->'recommendation'->'debtReservations') <> 'array' OR jsonb_typeof(p_payload->'recommendation'->'savingsReservations') <> 'array' THEN RAISE EXCEPTION 'Financial Plan recommendation is incomplete'; END IF;
  IF jsonb_array_length(p_payload->'recommendation'->'allocations') > 200 OR jsonb_array_length(p_payload->'recommendation'->'debtReservations') > 100 OR jsonb_array_length(p_payload->'recommendation'->'savingsReservations') > 100 THEN RAISE EXCEPTION 'Financial Plan recommendation is too large'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload->'recommendation'->'allocations') AS a(value) WHERE jsonb_typeof(a.value) <> 'object' OR (a.value ? 'categoryId') = (a.value ? 'subcategoryId') OR COALESCE(a.value->>'allocationRule', '') NOT IN ('FIXED', 'MINIMUM', 'FLEXIBLE') OR COALESCE(a.value->>'allocatedAmountCentavos', '') !~ '^[0-9]+$' OR COALESCE(a.value->>'floorAmountCentavos', '') !~ '^[0-9]+$' OR (a.value->>'allocatedAmountCentavos')::bigint < (a.value->>'floorAmountCentavos')::bigint) THEN RAISE EXCEPTION 'Financial Plan allocation is invalid'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload->'recommendation'->'debtReservations') AS r(value) WHERE jsonb_typeof(r.value) <> 'object' OR (r.value ? 'debtAccountId') = (r.value ? 'creditCardStatementId') OR COALESCE(r.value->>'amountCentavos', '') !~ '^[0-9]+$') THEN RAISE EXCEPTION 'Financial Plan debt reservation is invalid'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload->'recommendation'->'savingsReservations') AS r(value) WHERE jsonb_typeof(r.value) <> 'object' OR COALESCE(r.value->>'savingsGoalId', '') = '' OR COALESCE(r.value->>'amountCentavos', '') !~ '^[0-9]+$') THEN RAISE EXCEPTION 'Financial Plan savings reservation is invalid'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_payload->'recommendation'->'allocations') AS a("categoryId" uuid, "subcategoryId" uuid) LEFT JOIN categories c ON c.id = a."categoryId" AND c.user_id = v_user_id AND c.deleted = false AND c.is_active = true LEFT JOIN subcategories s ON s.id = a."subcategoryId" AND s.user_id = v_user_id AND s.deleted = false AND s.is_active = true AND s.kind = 'expense' WHERE (a."categoryId" IS NOT NULL AND c.id IS NULL) OR (a."subcategoryId" IS NOT NULL AND s.id IS NULL)) THEN RAISE EXCEPTION 'Financial Plan allocation is not accessible'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_payload->'recommendation'->'debtReservations') AS r("debtAccountId" uuid, "creditCardStatementId" uuid) LEFT JOIN debt_accounts d ON d.id = r."debtAccountId" AND d.user_id = v_user_id AND d.deleted = false LEFT JOIN credit_card_statements c ON c.id = r."creditCardStatementId" AND c.user_id = v_user_id AND c.deleted = false WHERE (r."debtAccountId" IS NOT NULL AND d.id IS NULL) OR (r."creditCardStatementId" IS NOT NULL AND c.id IS NULL)) THEN RAISE EXCEPTION 'Financial Plan debt reservation is not accessible'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_payload->'recommendation'->'savingsReservations') AS r("savingsGoalId" uuid) LEFT JOIN savings_goals g ON g.id = r."savingsGoalId" AND g.user_id = v_user_id AND g.deleted = false WHERE g.id IS NULL) THEN RAISE EXCEPTION 'Financial Plan savings reservation is not accessible'; END IF;
  INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'));
  INSERT INTO financial_plans (id, user_id, period_start, period_end, status, input_snapshot_json, recommendation_json)
  VALUES (p_record_id, v_user_id, (p_payload->>'period_start')::date, (p_payload->>'period_end')::date, 'accepted', p_payload->'input_snapshot', p_payload->'recommendation');
  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', 1) WHERE operation_id = p_operation_id AND user_id = v_user_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_financial_plan_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_financial_plan_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
