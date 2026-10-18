-- Preserve continuous LP recommendations, including fractional centavos, on save and sync.
-- NUMERIC has no fixed scale, so PostgreSQL does not round recommendation amounts.
ALTER TABLE public.financial_plans
  ALTER COLUMN forecast_total_centavos TYPE numeric USING forecast_total_centavos::numeric,
  ALTER COLUMN available_funds_centavos TYPE numeric USING available_funds_centavos::numeric,
  ALTER COLUMN required_funds_centavos TYPE numeric USING required_funds_centavos::numeric,
  ALTER COLUMN shortfall_centavos TYPE numeric USING shortfall_centavos::numeric,
  ALTER COLUMN debt_surplus_centavos TYPE numeric USING debt_surplus_centavos::numeric,
  ALTER COLUMN savings_surplus_centavos TYPE numeric USING savings_surplus_centavos::numeric;

ALTER TABLE public.financial_plan_allocations
  ALTER COLUMN allocated_amount_centavos TYPE numeric USING allocated_amount_centavos::numeric,
  ALTER COLUMN floor_amount_centavos TYPE numeric USING floor_amount_centavos::numeric,
  ALTER COLUMN ceiling_amount_centavos TYPE numeric USING ceiling_amount_centavos::numeric,
  ALTER COLUMN forecast_amount_centavos TYPE numeric USING forecast_amount_centavos::numeric;

ALTER TABLE public.financial_plan_forecast_points
  ALTER COLUMN amount_centavos TYPE numeric USING amount_centavos::numeric;

ALTER TABLE public.financial_plan_debt_reservations
  ALTER COLUMN amount_centavos TYPE numeric USING amount_centavos::numeric;

ALTER TABLE public.financial_plan_savings_reservations
  ALTER COLUMN amount_centavos TYPE numeric USING amount_centavos::numeric;

CREATE OR REPLACE FUNCTION public.apply_financial_plan_sync_operation_base(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_month date := date_trunc('month', now() AT TIME ZONE 'Asia/Manila')::date;
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
  IF (p_payload->>'period_start')::date NOT IN (v_current_month, (v_current_month - interval '1 month')::date) OR (p_payload->>'period_end')::date <> ((p_payload->>'period_start')::date + interval '1 month - 1 day')::date THEN RAISE EXCEPTION 'Financial Plans can only cover the current calendar month or the one that just ended'; END IF;
  IF jsonb_typeof(p_payload->'input_snapshot') <> 'object' OR jsonb_typeof(p_payload->'recommendation') <> 'object' THEN RAISE EXCEPTION 'Financial Plan documents must be objects'; END IF;
  IF NOT (p_payload->'input_snapshot' ?& ARRAY['forecast', 'restrictions', 'obligations', 'debtRequirements', 'savingsRequirements', 'classification']) THEN RAISE EXCEPTION 'Financial Plan input snapshot is incomplete'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['forecast', 'restrictions', 'obligations', 'debtRequirements', 'savingsRequirements', 'classification']) AS key WHERE jsonb_typeof(p_payload->'input_snapshot'->key) <> 'object' OR p_payload->'input_snapshot'->key = '{}'::jsonb) THEN RAISE EXCEPTION 'Financial Plan input snapshot is invalid'; END IF;
  IF jsonb_typeof(p_payload->'recommendation'->'allocations') <> 'array' OR jsonb_typeof(p_payload->'recommendation'->'debtReservations') <> 'array' OR jsonb_typeof(p_payload->'recommendation'->'savingsReservations') <> 'array' THEN RAISE EXCEPTION 'Financial Plan recommendation is incomplete'; END IF;
  IF jsonb_array_length(p_payload->'recommendation'->'allocations') > 200 OR jsonb_array_length(p_payload->'recommendation'->'debtReservations') > 100 OR jsonb_array_length(p_payload->'recommendation'->'savingsReservations') > 100 THEN RAISE EXCEPTION 'Financial Plan recommendation is too large'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload->'recommendation'->'allocations') AS a(value) WHERE jsonb_typeof(a.value) <> 'object' OR (NULLIF(a.value->>'categoryId', '') IS NULL) = (NULLIF(a.value->>'subcategoryId', '') IS NULL) OR COALESCE(a.value->>'allocationRule', '') NOT IN ('FIXED', 'MINIMUM', 'FLEXIBLE') OR COALESCE(a.value->>'allocatedAmountCentavos', '') !~ '^[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' OR COALESCE(a.value->>'floorAmountCentavos', '') !~ '^[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' OR (a.value->>'allocatedAmountCentavos')::numeric < (a.value->>'floorAmountCentavos')::numeric) THEN RAISE EXCEPTION 'Financial Plan allocation is invalid'; END IF;
  IF COALESCE(p_payload->'recommendation'->>'availableFundsCentavos', '') !~ '^[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' OR (SELECT COALESCE(SUM((a.value->>'allocatedAmountCentavos')::numeric), 0) FROM jsonb_array_elements(p_payload->'recommendation'->'allocations') AS a(value)) > (p_payload->'recommendation'->>'availableFundsCentavos')::numeric THEN RAISE EXCEPTION 'Financial Plan allocations exceed available funds'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload->'recommendation'->'debtReservations') AS r(value) WHERE jsonb_typeof(r.value) <> 'object' OR (NULLIF(r.value->>'debtAccountId', '') IS NULL) = (NULLIF(r.value->>'creditCardStatementId', '') IS NULL) OR COALESCE(r.value->>'amountCentavos', '') !~ '^[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$') THEN RAISE EXCEPTION 'Financial Plan debt reservation is invalid'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload->'recommendation'->'savingsReservations') AS r(value) WHERE jsonb_typeof(r.value) <> 'object' OR COALESCE(r.value->>'savingsGoalId', '') = '' OR COALESCE(r.value->>'amountCentavos', '') !~ '^[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$') THEN RAISE EXCEPTION 'Financial Plan savings reservation is invalid'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_payload->'recommendation'->'allocations') AS a("categoryId" uuid, "subcategoryId" uuid) LEFT JOIN categories c ON c.id = a."categoryId" AND c.user_id = v_user_id AND c.deleted = false AND c.is_active = true LEFT JOIN subcategories s ON s.id = a."subcategoryId" AND s.user_id = v_user_id AND s.deleted = false AND s.is_active = true AND s.kind = 'expense' WHERE (a."categoryId" IS NOT NULL AND c.id IS NULL) OR (a."subcategoryId" IS NOT NULL AND s.id IS NULL)) THEN RAISE EXCEPTION 'Financial Plan allocation is not accessible'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_payload->'recommendation'->'debtReservations') AS r("debtAccountId" uuid, "creditCardStatementId" uuid) LEFT JOIN debt_accounts d ON d.id = r."debtAccountId" AND d.user_id = v_user_id AND d.deleted = false LEFT JOIN credit_card_statements c ON c.id = r."creditCardStatementId" AND c.user_id = v_user_id AND c.deleted = false WHERE (r."debtAccountId" IS NOT NULL AND d.id IS NULL) OR (r."creditCardStatementId" IS NOT NULL AND c.id IS NULL)) THEN RAISE EXCEPTION 'Financial Plan debt reservation is not accessible'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_payload->'recommendation'->'savingsReservations') AS r("savingsGoalId" uuid) LEFT JOIN savings_goals g ON g.id = r."savingsGoalId" AND g.user_id = v_user_id AND g.deleted = false WHERE g.id IS NULL) THEN RAISE EXCEPTION 'Financial Plan savings reservation is not accessible'; END IF;
  INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'));
  INSERT INTO financial_plans (id, user_id, period_start, period_end, status, forecast_month, forecast_total_centavos, forecast_model_version, forecast_generated_at, forecast_quality, classification_status, classification_rule_set_version, classification_assessed_at, available_funds_centavos, required_funds_centavos, shortfall_centavos)
  VALUES (p_record_id, v_user_id, (p_payload->>'period_start')::date, (p_payload->>'period_end')::date, 'accepted', p_payload->'input_snapshot'->'forecast'->>'month', (p_payload->'input_snapshot'->'forecast'->>'totalAmountCentavos')::numeric, p_payload->'input_snapshot'->'forecast'->>'modelVersion', (p_payload->'input_snapshot'->'forecast'->>'generatedAt')::timestamptz, p_payload->'input_snapshot'->'forecast'->>'quality', p_payload->'input_snapshot'->'classification'->>'status', p_payload->'input_snapshot'->'classification'->>'rule_set_version', NULLIF(p_payload->'input_snapshot'->'classification'->>'assessed_at', '')::timestamptz, (p_payload->'recommendation'->>'availableFundsCentavos')::numeric, NULLIF(p_payload->'recommendation'->>'requiredFundsCentavos', '')::numeric, NULLIF(p_payload->'recommendation'->>'shortfallCentavos', '')::numeric);
  INSERT INTO financial_plan_forecast_points (plan_id, category_key, amount_centavos) SELECT p_record_id, point->>'category', (point->>'amountCentavos')::numeric FROM jsonb_array_elements(p_payload->'input_snapshot'->'forecast'->'categoryForecasts') AS point;
  INSERT INTO financial_plan_allocations (id, plan_id, category_id, subcategory_id, allocation_rule, allocated_amount_centavos, floor_amount_centavos, ceiling_amount_centavos, forecast_amount_centavos, subcategory_weight_bps) SELECT gen_random_uuid(), p_record_id, NULLIF(item->>'categoryId', '')::uuid, NULLIF(item->>'subcategoryId', '')::uuid, item->>'allocationRule', (item->>'allocatedAmountCentavos')::numeric, (item->>'floorAmountCentavos')::numeric, NULLIF(item->>'ceilingAmountCentavos', '')::numeric, NULLIF(item->>'forecastAmountCentavos', '')::numeric, NULLIF(item->>'subcategoryWeightBps', '')::integer FROM jsonb_array_elements(p_payload->'recommendation'->'allocations') AS item;
  INSERT INTO financial_plan_debt_reservations (id, plan_id, debt_account_id, credit_card_statement_id, amount_centavos, due_date) SELECT gen_random_uuid(), p_record_id, NULLIF(item->>'debtAccountId', '')::uuid, NULLIF(item->>'creditCardStatementId', '')::uuid, (item->>'amountCentavos')::numeric, NULLIF(item->>'dueDate', '')::date FROM jsonb_array_elements(p_payload->'recommendation'->'debtReservations') AS item;
  INSERT INTO financial_plan_savings_reservations (id, plan_id, savings_goal_id, amount_centavos, due_date) SELECT gen_random_uuid(), p_record_id, (item->>'savingsGoalId')::uuid, (item->>'amountCentavos')::numeric, NULLIF(item->>'dueDate', '')::date FROM jsonb_array_elements(p_payload->'recommendation'->'savingsReservations') AS item;
  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', 1) WHERE operation_id = p_operation_id AND user_id = v_user_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_financial_plan_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_result jsonb;
  v_current_version integer;
  v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity = 'financial_plans' AND p_operation_type = 'delete' THEN
    SELECT result INTO v_existing_result FROM applied_operations
    WHERE operation_id = p_operation_id AND user_id = v_user_id;
    IF v_existing_result IS NOT NULL THEN
      RETURN QUERY SELECT COALESCE(v_existing_result->>'status', 'duplicate'), NULLIF(v_existing_result->>'reason', ''), (v_existing_result->>'current_version')::integer, NULL::text[];
      RETURN;
    END IF;

    SELECT plan.version INTO v_current_version FROM financial_plans AS plan
    WHERE plan.id = p_record_id AND plan.user_id = v_user_id
      AND plan.status = 'accepted' AND plan.deleted = false
    FOR UPDATE;
    IF v_current_version IS NULL THEN RAISE EXCEPTION 'Financial Plan is not accessible'; END IF;
    IF p_base_version IS NULL OR p_base_version <> v_current_version THEN RAISE EXCEPTION 'Financial Plan version changed'; END IF;

    INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
    VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'));
    DELETE FROM financial_plan_forecast_points WHERE plan_id = p_record_id;
    DELETE FROM financial_plan_allocations WHERE plan_id = p_record_id;
    DELETE FROM financial_plan_debt_reservations WHERE plan_id = p_record_id;
    DELETE FROM financial_plan_savings_reservations WHERE plan_id = p_record_id;
    UPDATE financial_plans SET input_snapshot_json = NULL, recommendation_json = NULL, deleted = true, version = version + 1, updated_at = now()
    WHERE id = p_record_id AND user_id = v_user_id;
    UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_current_version + 1)
    WHERE operation_id = p_operation_id AND user_id = v_user_id;
    RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
    RETURN;
  END IF;

  SELECT result INTO v_existing_result FROM applied_operations
  WHERE operation_id = p_operation_id AND user_id = v_user_id;
  IF v_existing_result IS NOT NULL THEN
    RETURN QUERY SELECT COALESCE(v_existing_result->>'status', 'duplicate'), NULLIF(v_existing_result->>'reason', ''), (v_existing_result->>'current_version')::integer, NULL::text[];
    RETURN;
  END IF;

  SELECT * INTO v_result FROM public.apply_financial_plan_sync_operation_base(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
  IF v_result.status IN ('applied', 'duplicate') THEN
    UPDATE public.financial_plans
    SET debt_surplus_centavos = COALESCE((p_payload->'recommendation'->>'debtSurplusCentavos')::numeric, 0),
        savings_surplus_centavos = COALESCE((p_payload->'recommendation'->>'savingsSurplusCentavos')::numeric, 0)
    WHERE id = p_record_id AND user_id = v_user_id;
    IF v_result.status = 'applied' THEN
      UPDATE public.financial_plans
      SET input_snapshot_json = p_payload->'input_snapshot',
          recommendation_json = p_payload->'recommendation'
      WHERE id = p_record_id AND user_id = v_user_id AND deleted = false
        AND input_snapshot_json IS NULL AND recommendation_json IS NULL;
    END IF;
  END IF;
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;
