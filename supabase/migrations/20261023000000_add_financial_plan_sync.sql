CREATE TABLE IF NOT EXISTS public.financial_plans (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL CHECK (status = 'accepted'),
  forecast_month text NOT NULL,
  forecast_total_centavos bigint NOT NULL CHECK (forecast_total_centavos >= 0),
  forecast_model_version text NOT NULL,
  forecast_generated_at timestamptz NOT NULL,
  forecast_quality text NOT NULL,
  classification_status text,
  classification_rule_set_version text,
  classification_assessed_at timestamptz,
  available_funds_centavos bigint NOT NULL CHECK (available_funds_centavos >= 0),
  required_funds_centavos bigint,
  shortfall_centavos bigint,
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

CREATE TABLE IF NOT EXISTS public.financial_plan_forecast_points (
  plan_id uuid NOT NULL REFERENCES public.financial_plans(id), category_key text NOT NULL,
  amount_centavos bigint NOT NULL CHECK (amount_centavos >= 0), PRIMARY KEY (plan_id, category_key)
);
CREATE TABLE IF NOT EXISTS public.financial_plan_allocations (
  id uuid PRIMARY KEY, plan_id uuid NOT NULL REFERENCES public.financial_plans(id),
  category_id uuid REFERENCES public.categories(id), subcategory_id uuid REFERENCES public.subcategories(id),
  allocation_rule text NOT NULL CHECK (allocation_rule IN ('FIXED', 'MINIMUM', 'FLEXIBLE')),
  allocated_amount_centavos bigint NOT NULL CHECK (allocated_amount_centavos >= 0), floor_amount_centavos bigint NOT NULL CHECK (floor_amount_centavos >= 0),
  ceiling_amount_centavos bigint, forecast_amount_centavos bigint, subcategory_weight_bps integer,
  CHECK ((category_id IS NULL) <> (subcategory_id IS NULL))
);
CREATE TABLE IF NOT EXISTS public.financial_plan_debt_reservations (
  id uuid PRIMARY KEY, plan_id uuid NOT NULL REFERENCES public.financial_plans(id), debt_account_id uuid REFERENCES public.debt_accounts(id), credit_card_statement_id uuid REFERENCES public.credit_card_statements(id),
  amount_centavos bigint NOT NULL CHECK (amount_centavos >= 0), due_date date, CHECK ((debt_account_id IS NULL) <> (credit_card_statement_id IS NULL))
);
CREATE TABLE IF NOT EXISTS public.financial_plan_savings_reservations (
  id uuid PRIMARY KEY, plan_id uuid NOT NULL REFERENCES public.financial_plans(id), savings_goal_id uuid NOT NULL REFERENCES public.savings_goals(id), amount_centavos bigint NOT NULL CHECK (amount_centavos >= 0), due_date date
);

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
  IF COALESCE(p_payload->'recommendation'->>'availableFundsCentavos', '') !~ '^[0-9]+$' OR (SELECT COALESCE(SUM((a.value->>'allocatedAmountCentavos')::bigint), 0) FROM jsonb_array_elements(p_payload->'recommendation'->'allocations') AS a(value)) > (p_payload->'recommendation'->>'availableFundsCentavos')::bigint THEN RAISE EXCEPTION 'Financial Plan allocations exceed available funds'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload->'recommendation'->'debtReservations') AS r(value) WHERE jsonb_typeof(r.value) <> 'object' OR (r.value ? 'debtAccountId') = (r.value ? 'creditCardStatementId') OR COALESCE(r.value->>'amountCentavos', '') !~ '^[0-9]+$') THEN RAISE EXCEPTION 'Financial Plan debt reservation is invalid'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload->'recommendation'->'savingsReservations') AS r(value) WHERE jsonb_typeof(r.value) <> 'object' OR COALESCE(r.value->>'savingsGoalId', '') = '' OR COALESCE(r.value->>'amountCentavos', '') !~ '^[0-9]+$') THEN RAISE EXCEPTION 'Financial Plan savings reservation is invalid'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_payload->'recommendation'->'allocations') AS a("categoryId" uuid, "subcategoryId" uuid) LEFT JOIN categories c ON c.id = a."categoryId" AND c.user_id = v_user_id AND c.deleted = false AND c.is_active = true LEFT JOIN subcategories s ON s.id = a."subcategoryId" AND s.user_id = v_user_id AND s.deleted = false AND s.is_active = true AND s.kind = 'expense' WHERE (a."categoryId" IS NOT NULL AND c.id IS NULL) OR (a."subcategoryId" IS NOT NULL AND s.id IS NULL)) THEN RAISE EXCEPTION 'Financial Plan allocation is not accessible'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_payload->'recommendation'->'debtReservations') AS r("debtAccountId" uuid, "creditCardStatementId" uuid) LEFT JOIN debt_accounts d ON d.id = r."debtAccountId" AND d.user_id = v_user_id AND d.deleted = false LEFT JOIN credit_card_statements c ON c.id = r."creditCardStatementId" AND c.user_id = v_user_id AND c.deleted = false WHERE (r."debtAccountId" IS NOT NULL AND d.id IS NULL) OR (r."creditCardStatementId" IS NOT NULL AND c.id IS NULL)) THEN RAISE EXCEPTION 'Financial Plan debt reservation is not accessible'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_payload->'recommendation'->'savingsReservations') AS r("savingsGoalId" uuid) LEFT JOIN savings_goals g ON g.id = r."savingsGoalId" AND g.user_id = v_user_id AND g.deleted = false WHERE g.id IS NULL) THEN RAISE EXCEPTION 'Financial Plan savings reservation is not accessible'; END IF;
  INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'));
  INSERT INTO financial_plans (id, user_id, period_start, period_end, status, forecast_month, forecast_total_centavos, forecast_model_version, forecast_generated_at, forecast_quality, classification_status, classification_rule_set_version, classification_assessed_at, available_funds_centavos, required_funds_centavos, shortfall_centavos)
  VALUES (p_record_id, v_user_id, (p_payload->>'period_start')::date, (p_payload->>'period_end')::date, 'accepted', p_payload->'input_snapshot'->'forecast'->>'month', (p_payload->'input_snapshot'->'forecast'->>'totalAmountCentavos')::bigint, p_payload->'input_snapshot'->'forecast'->>'modelVersion', (p_payload->'input_snapshot'->'forecast'->>'generatedAt')::timestamptz, p_payload->'input_snapshot'->'forecast'->>'quality', p_payload->'input_snapshot'->'classification'->>'status', p_payload->'input_snapshot'->'classification'->>'rule_set_version', NULLIF(p_payload->'input_snapshot'->'classification'->>'assessed_at', '')::timestamptz, (p_payload->'recommendation'->>'availableFundsCentavos')::bigint, NULLIF(p_payload->'recommendation'->>'requiredFundsCentavos', '')::bigint, NULLIF(p_payload->'recommendation'->>'shortfallCentavos', '')::bigint);
  INSERT INTO financial_plan_forecast_points (plan_id, category_key, amount_centavos) SELECT p_record_id, point->>'category', (point->>'amountCentavos')::bigint FROM jsonb_array_elements(p_payload->'input_snapshot'->'forecast'->'categoryForecasts') AS point;
  INSERT INTO financial_plan_allocations (id, plan_id, category_id, subcategory_id, allocation_rule, allocated_amount_centavos, floor_amount_centavos, ceiling_amount_centavos, forecast_amount_centavos, subcategory_weight_bps) SELECT gen_random_uuid(), p_record_id, NULLIF(item->>'categoryId', '')::uuid, NULLIF(item->>'subcategoryId', '')::uuid, item->>'allocationRule', (item->>'allocatedAmountCentavos')::bigint, (item->>'floorAmountCentavos')::bigint, NULLIF(item->>'ceilingAmountCentavos', '')::bigint, NULLIF(item->>'forecastAmountCentavos', '')::bigint, NULLIF(item->>'subcategoryWeightBps', '')::integer FROM jsonb_array_elements(p_payload->'recommendation'->'allocations') AS item;
  INSERT INTO financial_plan_debt_reservations (id, plan_id, debt_account_id, credit_card_statement_id, amount_centavos, due_date) SELECT gen_random_uuid(), p_record_id, NULLIF(item->>'debtAccountId', '')::uuid, NULLIF(item->>'creditCardStatementId', '')::uuid, (item->>'amountCentavos')::bigint, NULLIF(item->>'dueDate', '')::date FROM jsonb_array_elements(p_payload->'recommendation'->'debtReservations') AS item;
  INSERT INTO financial_plan_savings_reservations (id, plan_id, savings_goal_id, amount_centavos, due_date) SELECT gen_random_uuid(), p_record_id, (item->>'savingsGoalId')::uuid, (item->>'amountCentavos')::bigint, NULLIF(item->>'dueDate', '')::date FROM jsonb_array_elements(p_payload->'recommendation'->'savingsReservations') AS item;
  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', 1) WHERE operation_id = p_operation_id AND user_id = v_user_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_financial_plan_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_financial_plan_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
