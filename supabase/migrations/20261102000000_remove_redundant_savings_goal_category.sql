DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.savings_goals
    WHERE goal_category IS DISTINCT FROM goal_type
  ) THEN
    RAISE EXCEPTION 'savings_goals.goal_category differs from goal_type';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.apply_savings_goal_contribution_schedule_sync_operation(
  p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text,
  p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_version integer;
  v_existing_user_id uuid;
  v_existing_result jsonb;
  v_fields text[] := ARRAY[
    'name', 'goal_type', 'target_amount_centavos', 'starting_amount_centavos',
    'target_date', 'priority', 'emergency_fund_baseline_centavos',
    'auto_save_amount_centavos', 'planned_contribution_amount_centavos',
    'contribution_frequency', 'contribution_interval_count',
    'contribution_day_of_month', 'contribution_second_day_of_month',
    'contribution_day_of_week', 'custom_interval_days', 'next_contribution_date',
    'interest_rate_bps', 'notes', 'emergency_fund_target_method',
    'essential_expense_coverage_months'
  ];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'operation type is invalid'; END IF;
  IF p_changed_fields IS NOT NULL AND NOT (p_changed_fields <@ v_fields) THEN RAISE EXCEPTION 'invalid savings goal fields'; END IF;

  INSERT INTO applied_operations(operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, 'savings_goals', p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
  ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT user_id, result INTO v_existing_user_id, v_existing_result FROM applied_operations WHERE operation_id = p_operation_id;
    IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
    ELSE
      RETURN QUERY SELECT COALESCE(v_existing_result->>'status', 'duplicate')::text, NULLIF(v_existing_result->>'reason', ''), CASE WHEN v_existing_result ? 'current_version' THEN (v_existing_result->>'current_version')::integer END, NULL::text[];
    END IF;
    RETURN;
  END IF;

  IF p_operation_type = 'create' THEN
    IF p_base_version IS NOT NULL
      OR NOT (p_payload ?& ARRAY['name', 'goal_type', 'target_amount_centavos', 'starting_amount_centavos', 'target_date', 'priority', 'planned_contribution_amount_centavos', 'contribution_frequency', 'next_contribution_date'])
      OR p_payload->>'name' IS NULL OR length(btrim(p_payload->>'name')) = 0
      OR p_payload->>'goal_type' NOT IN ('emergency_fund', 'custom')
      OR p_payload->>'priority' NOT IN ('low', 'medium', 'high')
      OR p_payload->>'contribution_frequency' NOT IN ('weekly', 'biweekly', 'semi_monthly', 'monthly', 'quarterly', 'yearly', 'custom')
      OR p_payload->>'target_amount_centavos' !~ '^[1-9][0-9]*$'
      OR p_payload->>'starting_amount_centavos' !~ '^[0-9]+$'
      OR p_payload->>'planned_contribution_amount_centavos' !~ '^[0-9]+$'
      OR (p_payload->>'next_contribution_date')::date > (p_payload->>'target_date')::date
    THEN RAISE EXCEPTION 'invalid savings goal contribution schedule payload'; END IF;

    INSERT INTO savings_goals (
      id, user_id, name, goal_type, target_amount_centavos, starting_amount_centavos,
      target_date, priority, emergency_fund_baseline_centavos, auto_save_amount_centavos,
      planned_contribution_amount_centavos, contribution_frequency,
      contribution_interval_count, contribution_day_of_month,
      contribution_second_day_of_month, contribution_day_of_week, custom_interval_days,
      next_contribution_date, interest_rate_bps, notes, emergency_fund_target_method,
      essential_expense_coverage_months, status, version, deleted
    ) VALUES (
      p_record_id, v_user_id, btrim(p_payload->>'name'), p_payload->>'goal_type',
      (p_payload->>'target_amount_centavos')::bigint,
      (p_payload->>'starting_amount_centavos')::bigint,
      (p_payload->>'target_date')::date, p_payload->>'priority',
      NULLIF(p_payload->>'emergency_fund_baseline_centavos', '')::bigint,
      COALESCE(NULLIF(p_payload->>'auto_save_amount_centavos', '')::bigint, (p_payload->>'planned_contribution_amount_centavos')::bigint),
      (p_payload->>'planned_contribution_amount_centavos')::bigint,
      p_payload->>'contribution_frequency',
      COALESCE(NULLIF(p_payload->>'contribution_interval_count', '')::integer, 1),
      NULLIF(p_payload->>'contribution_day_of_month', '')::integer,
      NULLIF(p_payload->>'contribution_second_day_of_month', '')::integer,
      NULLIF(p_payload->>'contribution_day_of_week', '')::integer,
      NULLIF(p_payload->>'custom_interval_days', '')::integer,
      (p_payload->>'next_contribution_date')::date,
      NULLIF(p_payload->>'interest_rate_bps', '')::integer, p_payload->>'notes',
      COALESCE(p_payload->>'emergency_fund_target_method', 'fixed_amount'),
      NULLIF(p_payload->>'essential_expense_coverage_months', '')::integer,
      'active', 1, false
    );
    UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', 1) WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
    RETURN;
  END IF;

  SELECT version INTO v_current_version FROM savings_goals WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  IF v_current_version IS NULL THEN
    UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'record not found') WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'rejected'::text, 'record not found'::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;
  IF p_base_version IS NULL OR p_base_version <> v_current_version THEN
    UPDATE applied_operations SET result = jsonb_build_object('status', 'conflict', 'current_version', v_current_version, 'conflicted_fields', to_jsonb(p_changed_fields)) WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'conflict'::text, 'savings goal version changed'::text, v_current_version, p_changed_fields;
    RETURN;
  END IF;
  IF p_operation_type = 'delete' THEN
    UPDATE savings_goals SET status = 'deleted', deleted = true, version = version + 1, updated_at = now() WHERE id = p_record_id AND user_id = v_user_id;
  ELSE
    IF p_changed_fields IS NULL OR array_length(p_changed_fields, 1) IS NULL THEN RAISE EXCEPTION 'savings goal update requires changed fields'; END IF;
    UPDATE savings_goals SET
      name = CASE WHEN 'name' = ANY(p_changed_fields) THEN btrim(p_payload->>'name') ELSE name END,
      goal_type = CASE WHEN 'goal_type' = ANY(p_changed_fields) THEN p_payload->>'goal_type' ELSE goal_type END,
      target_amount_centavos = CASE WHEN 'target_amount_centavos' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'target_amount_centavos', '')::bigint ELSE target_amount_centavos END,
      starting_amount_centavos = CASE WHEN 'starting_amount_centavos' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'starting_amount_centavos', '')::bigint ELSE starting_amount_centavos END,
      target_date = CASE WHEN 'target_date' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'target_date', '')::date ELSE target_date END,
      priority = CASE WHEN 'priority' = ANY(p_changed_fields) THEN p_payload->>'priority' ELSE priority END,
      emergency_fund_baseline_centavos = CASE WHEN 'emergency_fund_baseline_centavos' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'emergency_fund_baseline_centavos', '')::bigint ELSE emergency_fund_baseline_centavos END,
      auto_save_amount_centavos = CASE WHEN 'auto_save_amount_centavos' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'auto_save_amount_centavos', '')::bigint ELSE auto_save_amount_centavos END,
      planned_contribution_amount_centavos = CASE WHEN 'planned_contribution_amount_centavos' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'planned_contribution_amount_centavos', '')::bigint ELSE planned_contribution_amount_centavos END,
      contribution_frequency = CASE WHEN 'contribution_frequency' = ANY(p_changed_fields) THEN p_payload->>'contribution_frequency' ELSE contribution_frequency END,
      contribution_interval_count = CASE WHEN 'contribution_interval_count' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'contribution_interval_count', '')::integer ELSE contribution_interval_count END,
      contribution_day_of_month = CASE WHEN 'contribution_day_of_month' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'contribution_day_of_month', '')::integer ELSE contribution_day_of_month END,
      contribution_second_day_of_month = CASE WHEN 'contribution_second_day_of_month' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'contribution_second_day_of_month', '')::integer ELSE contribution_second_day_of_month END,
      contribution_day_of_week = CASE WHEN 'contribution_day_of_week' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'contribution_day_of_week', '')::integer ELSE contribution_day_of_week END,
      custom_interval_days = CASE WHEN 'custom_interval_days' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'custom_interval_days', '')::integer ELSE custom_interval_days END,
      next_contribution_date = CASE WHEN 'next_contribution_date' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'next_contribution_date', '')::date ELSE next_contribution_date END,
      interest_rate_bps = CASE WHEN 'interest_rate_bps' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'interest_rate_bps', '')::integer ELSE interest_rate_bps END,
      notes = CASE WHEN 'notes' = ANY(p_changed_fields) THEN p_payload->>'notes' ELSE notes END,
      emergency_fund_target_method = CASE WHEN 'emergency_fund_target_method' = ANY(p_changed_fields) THEN p_payload->>'emergency_fund_target_method' ELSE emergency_fund_target_method END,
      essential_expense_coverage_months = CASE WHEN 'essential_expense_coverage_months' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'essential_expense_coverage_months', '')::integer ELSE essential_expense_coverage_months END,
      version = version + 1, updated_at = now()
    WHERE id = p_record_id AND user_id = v_user_id AND deleted = false;
  END IF;
  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_current_version + 1) WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
END;
$$;

ALTER TABLE public.savings_goals DROP COLUMN goal_category;
