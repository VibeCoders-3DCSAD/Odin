-- Goal archiving is a reversible lifecycle transition, not a delete.
ALTER TABLE public.savings_goals
  DROP CONSTRAINT IF EXISTS savings_goals_status_check;

ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.savings_goals
  ADD CONSTRAINT savings_goals_status_check
  CHECK (status IN ('active', 'archived', 'deleted'));

CREATE OR REPLACE FUNCTION private.apply_savings_goal_lifecycle_sync_operation(
  p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text,
  p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_version integer;
  v_existing_user_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_operation_type <> 'update'
    OR p_changed_fields IS NULL
    OR NOT (p_changed_fields <@ ARRAY['status', 'archived_at'])
    OR p_payload->>'status' NOT IN ('active', 'archived')
  THEN RAISE EXCEPTION 'invalid savings goal lifecycle payload'; END IF;

  INSERT INTO public.applied_operations(operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, 'savings_goals', p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
  ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT user_id INTO v_existing_user_id FROM public.applied_operations WHERE operation_id = p_operation_id;
    IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
    ELSE
      RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
    END IF;
    RETURN;
  END IF;

  SELECT version INTO v_current_version
  FROM public.savings_goals
  WHERE id = p_record_id AND user_id = v_user_id AND deleted = false
  FOR UPDATE;
  IF v_current_version IS NULL THEN
    RETURN QUERY SELECT 'rejected'::text, 'record not found'::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;
  IF p_base_version IS NULL OR p_base_version <> v_current_version THEN
    RETURN QUERY SELECT 'conflict'::text, 'savings goal version changed'::text, v_current_version, p_changed_fields;
    RETURN;
  END IF;

  UPDATE public.savings_goals
  SET status = p_payload->>'status',
      archived_at = CASE WHEN p_payload->>'status' = 'archived' THEN now() ELSE NULL END,
      version = version + 1,
      updated_at = now()
  WHERE id = p_record_id AND user_id = v_user_id;
  UPDATE public.applied_operations
  SET result = jsonb_build_object('status', 'applied', 'current_version', v_current_version + 1)
  WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
END;
$$;

ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_sync_operation_before_savings_goal_lifecycle;

CREATE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF p_entity = 'savings_goals' AND p_operation_type = 'update'
    AND p_changed_fields <@ ARRAY['status', 'archived_at'] THEN
    RETURN QUERY SELECT * FROM private.apply_savings_goal_lifecycle_sync_operation(
      p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version,
      p_changed_fields, p_payload
    );
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.apply_sync_operation_before_savings_goal_lifecycle(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION private.apply_savings_goal_lifecycle_sync_operation(uuid, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
