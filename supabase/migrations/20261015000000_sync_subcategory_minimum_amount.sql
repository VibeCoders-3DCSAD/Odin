DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'apply_sync_operation_base'
      AND pg_get_function_identity_arguments(procedure.oid) = 'p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid, p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) RENAME TO apply_sync_operation_base';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.apply_subcategory_minimum_sync_operation(
  p_operation_id uuid,
  p_device_id text,
  p_entity text,
  p_record_id uuid,
  p_operation_type text,
  p_base_version integer,
  p_changed_fields text[],
  p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result record;
  v_existing_result jsonb;
  v_version integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT result INTO v_existing_result
  FROM applied_operations
  WHERE operation_id = p_operation_id AND user_id = v_user_id;

  IF v_existing_result ? 'minimum_amount_centavos_applied' THEN
    RETURN QUERY SELECT
      COALESCE(v_existing_result->>'status', 'duplicate'),
      NULLIF(v_existing_result->>'reason', ''),
      (v_existing_result->>'current_version')::integer,
      NULL::text[];
    RETURN;
  END IF;

  SELECT * INTO v_result
  FROM private.apply_sync_operation_ledger_core(
    p_operation_id,
    p_device_id,
    p_entity,
    p_record_id,
    p_operation_type,
    p_base_version,
    p_changed_fields,
    p_payload
  );

  IF v_result.status <> 'applied' AND v_result.status <> 'duplicate' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;

  UPDATE subcategories
  SET minimum_amount_centavos = CASE
        WHEN p_payload->>'minimum_amount_centavos' IS NULL THEN NULL
        ELSE (p_payload->>'minimum_amount_centavos')::bigint
      END,
      version = subcategories.version + 1,
      updated_at = now()
  WHERE id = p_record_id
    AND user_id = v_user_id
  RETURNING version INTO v_version;

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'subcategory not found for minimum update';
  END IF;

  UPDATE applied_operations
  SET result = jsonb_build_object(
        'status', 'applied',
        'current_version', v_version,
        'minimum_amount_centavos_applied', true
      )
  WHERE operation_id = p_operation_id AND user_id = v_user_id;

  RETURN QUERY SELECT 'applied'::text, NULL::text, v_version, v_result.conflicted_fields;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_sync_operation(
  p_operation_id uuid,
  p_device_id text,
  p_entity text,
  p_record_id uuid,
  p_operation_type text,
  p_base_version integer,
  p_changed_fields text[],
  p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
BEGIN
  IF p_entity = 'subcategories' AND p_payload ? 'minimum_amount_centavos' THEN
    RETURN QUERY SELECT * FROM private.apply_subcategory_minimum_sync_operation(
      p_operation_id,
      p_device_id,
      p_entity,
      p_record_id,
      p_operation_type,
      p_base_version,
      p_changed_fields,
      p_payload
    );
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.apply_sync_operation_base(
    p_operation_id,
    p_device_id,
    p_entity,
    p_record_id,
    p_operation_type,
    p_base_version,
    p_changed_fields,
    p_payload
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(
  uuid, text, text, uuid, text, integer, text[], jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(
  uuid, text, text, uuid, text, integer, text[], jsonb
) TO authenticated;
