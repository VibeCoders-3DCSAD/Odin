-- Preserve the active sync RPC and add back the local-only anomaly handler.
-- A prior wrapper replacement dropped this branch, leaving queued local insights
-- rejected even though anomaly_evaluations is a synced client entity.
ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_sync_operation_before_local_anomaly_evaluation_repair;

CREATE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF p_entity <> 'anomaly_evaluations' THEN
    RETURN QUERY SELECT * FROM public.apply_sync_operation_before_local_anomaly_evaluation_repair(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_operation_type <> 'create' OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid anomaly evaluation operation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE id = (p_payload->>'transaction_id')::uuid
      AND user_id = v_user_id AND deleted = false
  ) THEN RAISE EXCEPTION 'transaction is not accessible'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.subcategories
    WHERE id = (p_payload->>'subcategory_id')::uuid
      AND user_id = v_user_id AND deleted = false
  ) THEN RAISE EXCEPTION 'subcategory is not accessible'; END IF;

  INSERT INTO public.applied_operations (
    operation_id, user_id, device_id, entity, record_id, operation_type, result
  ) VALUES (
    p_operation_id, v_user_id, p_device_id, p_entity, p_record_id,
    p_operation_type, jsonb_build_object('status', 'pending')
  ) ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  INSERT INTO public.anomaly_evaluations (
    id, user_id, transaction_id, evaluated_at, model_version, profile_label,
    history_days, subcategory_id, amount_centavos, raw_anomaly_score,
    is_anomaly, should_alert_user, review_status, feature_vector,
    baseline_snapshot, version, deleted, updated_at
  ) VALUES (
    p_record_id, v_user_id, (p_payload->>'transaction_id')::uuid,
    COALESCE((p_payload->>'evaluated_at')::timestamptz, v_now),
    p_payload->>'model_version', NULL, (p_payload->>'usable_history_count')::integer,
    (p_payload->>'subcategory_id')::uuid, (p_payload->>'amount_centavos')::bigint,
    (p_payload->>'severity')::numeric, true, false, 'not_alerted',
    jsonb_build_object(
      'usual_spending_centavos', (p_payload->>'usual_spending_centavos')::bigint,
      'lower_bound_centavos', (p_payload->>'lower_bound_centavos')::bigint,
      'upper_bound_centavos', (p_payload->>'upper_bound_centavos')::bigint
    ), jsonb_build_object('scope', 'category_iqr'), 1, false, v_now
  ) ON CONFLICT (user_id, transaction_id) WHERE deleted = false DO NOTHING;

  UPDATE public.applied_operations
  SET result = jsonb_build_object('status', 'applied', 'current_version', 1)
  WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
END;
$$;

REVOKE ALL ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
