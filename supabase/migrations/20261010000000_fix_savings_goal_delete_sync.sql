CREATE OR REPLACE FUNCTION private.apply_savings_goal_delete_sync_operation(
  p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text,
  p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_version integer;
  v_existing_user_id uuid;
  v_existing_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_operation_type <> 'delete' OR COALESCE(array_length(p_changed_fields, 1), 0) <> 0
    OR p_payload <> '{}'::jsonb THEN
    RAISE EXCEPTION 'invalid savings goal delete operation';
  END IF;

  INSERT INTO public.applied_operations(operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, 'savings_goals', p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
  ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT user_id, result INTO v_existing_user_id, v_existing_result
    FROM public.applied_operations WHERE operation_id = p_operation_id;
    IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
    ELSE
      RETURN QUERY SELECT COALESCE(v_existing_result->>'status', 'duplicate')::text,
        NULLIF(v_existing_result->>'reason', ''),
        CASE WHEN v_existing_result ? 'current_version' THEN (v_existing_result->>'current_version')::integer END,
        NULL::text[];
    END IF;
    RETURN;
  END IF;

  SELECT version INTO v_current_version
  FROM public.savings_goals
  WHERE id = p_record_id AND user_id = v_user_id AND deleted = false
  FOR UPDATE;
  IF v_current_version IS NULL THEN
    UPDATE public.applied_operations
    SET result = jsonb_build_object('status', 'rejected', 'reason', 'record not found')
    WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'rejected'::text, 'record not found'::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;
  IF p_base_version IS NULL OR p_base_version <> v_current_version THEN
    UPDATE public.applied_operations
    SET result = jsonb_build_object('status', 'conflict', 'current_version', v_current_version)
    WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'conflict'::text, 'savings goal version changed'::text, v_current_version, ARRAY[]::text[];
    RETURN;
  END IF;

  UPDATE public.savings_goals
  SET status = 'deleted', deleted = true, deleted_at = now(),
      version = version + 1, updated_at = now()
  WHERE id = p_record_id AND user_id = v_user_id;
  UPDATE public.applied_operations
  SET result = jsonb_build_object('status', 'applied', 'current_version', v_current_version + 1)
  WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
END;
$$;

ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_sync_operation_before_savings_goal_delete;

CREATE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF p_entity = 'savings_goals' AND p_operation_type = 'delete' THEN
    RETURN QUERY SELECT * FROM private.apply_savings_goal_delete_sync_operation(
      p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version,
      p_changed_fields, p_payload
    );
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.apply_sync_operation_before_savings_goal_delete(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION private.apply_savings_goal_delete_sync_operation(uuid, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
