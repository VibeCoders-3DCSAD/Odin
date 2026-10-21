-- Optional reference settings never credit interest or modify account balances.
CREATE FUNCTION private.is_valid_savings_interest_reference(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE field text;
BEGIN
  IF value IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(value) <> 'object' THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(value) AS key WHERE key NOT IN ('balanceBasis', 'method', 'rateStructure', 'notes')) THEN RETURN false; END IF;
  IF value->>'balanceBasis' IS NOT NULL AND value->>'balanceBasis' NOT IN ('daily_balance', 'average_daily_balance') THEN RETURN false; END IF;
  IF value->>'method' IS NOT NULL AND value->>'method' NOT IN ('simple', 'compound') THEN RETURN false; END IF;
  IF value->>'rateStructure' IS NOT NULL AND value->>'rateStructure' NOT IN ('fixed', 'tiered') THEN RETURN false; END IF;
  FOREACH field IN ARRAY ARRAY['balanceBasis', 'method', 'rateStructure', 'notes'] LOOP
    IF value ? field AND jsonb_typeof(value->field) NOT IN ('string', 'null') THEN RETURN false; END IF;
  END LOOP;
  RETURN value->>'notes' IS NULL OR length(value->>'notes') <= 1000;
END;
$$;

ALTER TABLE public.savings_account_details ADD COLUMN interest_reference jsonb;
ALTER TABLE public.savings_account_details ADD CONSTRAINT savings_interest_reference_valid
  CHECK (private.is_valid_savings_interest_reference(interest_reference));

ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_sync_operation_before_interest_reference;
CREATE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  v_reference jsonb;
  v_fields text[];
  v_previous boolean;
  v_existing boolean;
  v_result record;
BEGIN
  IF p_entity <> 'savings_account_details' OR NOT (
    p_payload ? 'interest_reference' OR 'interest_reference' = ANY(COALESCE(p_changed_fields, ARRAY[]::text[]))
  ) THEN
    RETURN QUERY SELECT * FROM public.apply_sync_operation_before_interest_reference(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;
  IF NOT (p_payload ? 'interest_reference') THEN RAISE EXCEPTION 'interest reference is missing'; END IF;
  v_reference := NULLIF(p_payload->'interest_reference', 'null'::jsonb);
  IF NOT private.is_valid_savings_interest_reference(v_reference) THEN RAISE EXCEPTION 'invalid interest reference'; END IF;
  -- Serialize retries before checking whether this operation already ran.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  SELECT EXISTS(SELECT 1 FROM public.savings_account_details WHERE account_id = p_record_id AND user_id = auth.uid()) INTO v_existing;
  SELECT EXISTS(SELECT 1 FROM public.applied_operations WHERE operation_id = p_operation_id AND user_id = auth.uid()) INTO v_previous;
  SELECT COALESCE(array_agg(field), ARRAY[]::text[]) INTO v_fields
    FROM unnest(COALESCE(p_changed_fields, ARRAY[]::text[])) AS field WHERE field <> 'interest_reference';
  SELECT * INTO v_result FROM public.apply_sync_operation_before_interest_reference(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, v_fields, p_payload - 'interest_reference'
  );
  IF NOT v_previous AND v_result.status = 'applied' AND p_operation_type <> 'delete'
    AND ((p_operation_type = 'create' AND NOT v_existing) OR (p_operation_type = 'update' AND 'interest_reference' = ANY(p_changed_fields))) THEN
    UPDATE public.savings_account_details SET interest_reference = v_reference
      WHERE account_id = p_record_id AND user_id = auth.uid() AND deleted = false;
  END IF;
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
