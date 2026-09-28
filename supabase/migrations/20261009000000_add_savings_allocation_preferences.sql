CREATE TABLE IF NOT EXISTS public.savings_allocation_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy text NOT NULL CHECK (strategy IN ('avalanche', 'snowball')),
  version integer NOT NULL DEFAULT 1,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS savings_allocation_preferences_pull_idx
  ON public.savings_allocation_preferences (user_id, updated_at);

ALTER TABLE public.savings_allocation_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY savings_allocation_preferences_owner_access
  ON public.savings_allocation_preferences
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION private.apply_savings_allocation_preference(
  p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text,
  p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_version integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_record_id <> v_user_id OR p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'invalid savings allocation preference operation'; END IF;
  IF p_operation_type <> 'delete' AND (p_changed_fields IS NULL OR NOT (p_changed_fields <@ ARRAY['strategy']) OR p_payload->>'strategy' NOT IN ('avalanche', 'snowball')) THEN RAISE EXCEPTION 'invalid savings allocation preference payload'; END IF;
  INSERT INTO public.applied_operations(operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, 'savings_allocation_preferences', p_record_id, p_operation_type, jsonb_build_object('status', 'pending')) ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[]; RETURN; END IF;
  SELECT version INTO v_version FROM public.savings_allocation_preferences WHERE user_id = v_user_id FOR UPDATE;
  IF p_operation_type = 'create' THEN
    IF v_version IS NOT NULL THEN RETURN QUERY SELECT 'conflict'::text, 'preference already exists'::text, v_version, ARRAY['strategy']; RETURN; END IF;
    INSERT INTO public.savings_allocation_preferences (user_id, strategy, version, deleted) VALUES (v_user_id, p_payload->>'strategy', 1, false);
    RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[]; RETURN;
  END IF;
  IF v_version IS NULL THEN RETURN QUERY SELECT 'rejected'::text, 'preference not found'::text, NULL::integer, NULL::text[]; RETURN; END IF;
  IF p_base_version IS NULL OR p_base_version <> v_version THEN RETURN QUERY SELECT 'conflict'::text, 'savings allocation preference version changed'::text, v_version, p_changed_fields; RETURN; END IF;
  UPDATE public.savings_allocation_preferences SET strategy = CASE WHEN p_operation_type = 'delete' THEN strategy ELSE p_payload->>'strategy' END, deleted = p_operation_type = 'delete', version = version + 1, updated_at = now() WHERE user_id = v_user_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_version + 1, NULL::text[];
END;
$$;

ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_sync_operation_before_savings_allocation_preferences;

CREATE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF p_entity = 'savings_allocation_preferences' THEN
    RETURN QUERY SELECT * FROM private.apply_savings_allocation_preference(p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.apply_sync_operation_before_savings_allocation_preferences(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
END;
$$;

REVOKE EXECUTE ON FUNCTION private.apply_savings_allocation_preference(uuid, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
