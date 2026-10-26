-- A yearly unusual-spending answer may name the calendar months it comes back in, such as tuition
-- in June and November. Null keeps the payment's own month, as yearly answers meant before.
CREATE OR REPLACE FUNCTION private.is_recurrence_month_list(p_months smallint[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT cardinality(p_months) BETWEEN 1 AND 12
    AND array_position(p_months, NULL) IS NULL
    AND p_months <@ ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::smallint[]
    AND cardinality(p_months) = (SELECT count(DISTINCT month) FROM unnest(p_months) AS month);
$$;

ALTER TABLE public.anomaly_evaluations
  ADD COLUMN IF NOT EXISTS recurrence_months smallint[]
  CHECK (recurrence_months IS NULL OR (recurrence IS NOT DISTINCT FROM 'yearly' AND private.is_recurrence_month_list(recurrence_months)));

CREATE OR REPLACE FUNCTION private.apply_anomaly_evaluation_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_version integer;
  v_recurrence text;
  v_confirmed_at timestamptz;
  v_months smallint[];
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
    OR NOT (p_payload ? 'recurrence' OR p_payload ? 'confirmed_recurring_at')
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_payload) AS key
      WHERE key NOT IN ('recurrence', 'confirmed_recurring_at', 'recurrence_months')
    )
  THEN
    RAISE EXCEPTION 'invalid anomaly evaluation update';
  END IF;

  v_recurrence := COALESCE(p_payload->>'recurrence', 'frequent');
  v_confirmed_at := (p_payload->>'confirmed_recurring_at')::timestamptz;
  IF v_recurrence NOT IN ('one_time', 'frequent', 'yearly')
    OR (v_recurrence = 'frequent') <> (v_confirmed_at IS NOT NULL)
  THEN
    RAISE EXCEPTION 'invalid anomaly evaluation update';
  END IF;

  -- Months only accompany a yearly answer: whole numbers from 1 to 12, without repeats.
  IF p_payload ? 'recurrence_months' AND jsonb_typeof(p_payload->'recurrence_months') <> 'null' THEN
    IF v_recurrence <> 'yearly'
      OR jsonb_typeof(p_payload->'recurrence_months') <> 'array'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_payload->'recurrence_months') AS item
        WHERE jsonb_typeof(item) <> 'number' OR item::text !~ '^([1-9]|1[0-2])$'
      )
    THEN
      RAISE EXCEPTION 'invalid anomaly evaluation update';
    END IF;
    v_months := ARRAY(
      SELECT item::text::smallint FROM jsonb_array_elements(p_payload->'recurrence_months') AS item ORDER BY 1
    );
    IF NOT private.is_recurrence_month_list(v_months) THEN
      RAISE EXCEPTION 'invalid anomaly evaluation update';
    END IF;
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

  -- Every assignment reads the pre-update row, so a later answer never overwrites the first.
  UPDATE public.anomaly_evaluations
  SET recurrence = COALESCE(recurrence, v_recurrence),
      confirmed_recurring_at = CASE WHEN recurrence IS NULL THEN v_confirmed_at ELSE confirmed_recurring_at END,
      recurrence_months = CASE WHEN recurrence IS NULL THEN v_months ELSE recurrence_months END,
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

REVOKE ALL ON FUNCTION private.apply_anomaly_evaluation_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
