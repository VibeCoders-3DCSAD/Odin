-- Taxonomy and recurring-income dispatcher replacements bypassed the anomaly
-- wrappers. Restore an explicit route while preserving every current sync route.
-- Reuse the existing owned-transaction creation handler and restore confirmation
-- updates behind a private helper so later dispatcher changes have one target.
CREATE FUNCTION private.apply_anomaly_evaluation_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_version integer;
BEGIN
  IF p_entity <> 'anomaly_evaluations' THEN RAISE EXCEPTION 'invalid anomaly evaluation entity'; END IF;
  IF p_operation_type <> 'update' THEN
    RETURN QUERY SELECT * FROM public.apply_sync_operation_before_anomaly_recurring_confirmation(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
    OR p_payload->>'confirmed_recurring_at' IS NULL
    OR (SELECT array_agg(key) FROM jsonb_object_keys(p_payload) AS key) IS DISTINCT FROM ARRAY['confirmed_recurring_at']
  THEN
    RAISE EXCEPTION 'invalid anomaly evaluation update';
  END IF;

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

  SELECT version INTO v_version
  FROM public.anomaly_evaluations
  WHERE id = p_record_id AND user_id = v_user_id AND deleted = false
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'anomaly evaluation is not accessible'; END IF;

  IF p_base_version IS DISTINCT FROM v_version THEN
    UPDATE public.applied_operations
    SET result = jsonb_build_object('status', 'conflict', 'current_version', v_version,
      'conflicted_fields', to_jsonb(p_changed_fields))
    WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'conflict'::text, 'anomaly evaluation version changed'::text,
      v_version, p_changed_fields;
    RETURN;
  END IF;

  UPDATE public.anomaly_evaluations
  SET confirmed_recurring_at = COALESCE(confirmed_recurring_at, (p_payload->>'confirmed_recurring_at')::timestamptz),
      version = version + 1,
      updated_at = now()
  WHERE id = p_record_id AND user_id = v_user_id
  RETURNING version INTO v_version;

  UPDATE public.applied_operations
  SET result = jsonb_build_object('status', 'applied', 'current_version', v_version)
  WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_version, NULL::text[];
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_sync_operation(p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid, p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb)
 RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
BEGIN
  IF p_entity = 'anomaly_evaluations' THEN
    RETURN QUERY SELECT * FROM private.apply_anomaly_evaluation_sync_operation(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;

  IF p_entity IN ('categories', 'subcategories')
     AND (p_payload ? 'icon_key' OR p_payload ? 'color_hex') THEN
    RETURN QUERY SELECT * FROM private.apply_taxonomy_visual_sync_operation(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;

  IF p_entity = 'categories' AND p_operation_type = 'create' THEN
    RETURN QUERY SELECT * FROM private.apply_category_create_sync_operation(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;

  IF p_entity = 'subcategories'
     AND (p_payload ? 'minimum_amount_centavos' OR p_payload ? 'always_in_budget' OR p_payload ? 'fixed_amount_centavos') THEN
    RETURN QUERY SELECT * FROM private.apply_subcategory_budget_config_sync_operation(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;

  IF p_entity = 'recurring_transaction_occurrences' AND p_operation_type = 'create' THEN
    RETURN QUERY SELECT * FROM private.apply_recurring_occurrence_create_sync_operation(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM private.apply_sync_operation_ledger_core(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
END;
$function$;

REVOKE ALL ON FUNCTION private.apply_anomaly_evaluation_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
