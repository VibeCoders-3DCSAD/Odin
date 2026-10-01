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
    UPDATE financial_plans SET deleted = true, version = version + 1, updated_at = now()
    WHERE id = p_record_id AND user_id = v_user_id;
    UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_current_version + 1)
    WHERE operation_id = p_operation_id AND user_id = v_user_id;
    RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
    RETURN;
  END IF;

  SELECT * INTO v_result FROM public.apply_financial_plan_sync_operation_base(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
  IF v_result.status IN ('applied', 'duplicate') THEN
    UPDATE public.financial_plans
    SET debt_surplus_centavos = COALESCE((p_payload->'recommendation'->>'debtSurplusCentavos')::bigint, 0),
        savings_surplus_centavos = COALESCE((p_payload->'recommendation'->>'savingsSurplusCentavos')::bigint, 0)
    WHERE id = p_record_id AND user_id = v_user_id;
  END IF;
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;
