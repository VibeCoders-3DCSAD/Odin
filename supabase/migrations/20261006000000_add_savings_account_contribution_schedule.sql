ALTER TABLE public.savings_account_details
  ADD COLUMN IF NOT EXISTS planned_contribution_amount_centavos bigint,
  ADD COLUMN IF NOT EXISTS contribution_frequency text,
  ADD COLUMN IF NOT EXISTS contribution_interval_count integer,
  ADD COLUMN IF NOT EXISTS contribution_day_of_month integer,
  ADD COLUMN IF NOT EXISTS contribution_second_day_of_month integer,
  ADD COLUMN IF NOT EXISTS contribution_day_of_week integer,
  ADD COLUMN IF NOT EXISTS custom_interval_days integer,
  ADD COLUMN IF NOT EXISTS next_contribution_date date,
  ADD CONSTRAINT savings_account_details_contribution_frequency_check CHECK (
    contribution_frequency IS NULL OR contribution_frequency IN
      ('weekly', 'biweekly', 'semi_monthly', 'monthly', 'quarterly', 'yearly', 'custom')
  ),
  ADD CONSTRAINT savings_account_details_contribution_schedule_check CHECK (
    account_type = 'time_deposit'
    OR contribution_frequency IS NULL
    OR (planned_contribution_amount_centavos >= 0
      AND contribution_frequency IS NOT NULL
      AND next_contribution_date IS NOT NULL)
  ),
  ADD CONSTRAINT savings_account_details_contribution_day_check CHECK (
    (contribution_day_of_month IS NULL OR contribution_day_of_month BETWEEN 1 AND 31)
    AND (contribution_second_day_of_month IS NULL OR contribution_second_day_of_month BETWEEN 1 AND 31)
    AND (contribution_day_of_week IS NULL OR contribution_day_of_week BETWEEN 0 AND 6)
    AND (contribution_interval_count IS NULL OR contribution_interval_count > 0)
    AND (contribution_frequency IS DISTINCT FROM 'custom' OR COALESCE(custom_interval_days > 0, false))
    AND (contribution_frequency IS DISTINCT FROM 'semi_monthly' OR COALESCE(contribution_day_of_month < contribution_second_day_of_month, false))
  );

CREATE OR REPLACE FUNCTION private.apply_savings_account_contribution_schedule_sync_operation(
  p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text,
  p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  v_schedule_fields text[] := ARRAY['planned_contribution_amount_centavos', 'contribution_frequency', 'contribution_interval_count', 'contribution_day_of_month', 'contribution_second_day_of_month', 'contribution_day_of_week', 'custom_interval_days', 'next_contribution_date'];
  v_base_fields text[];
  v_previous boolean;
  v_result record;
BEGIN
  IF p_operation_type = 'create' AND p_payload->>'account_type' <> 'time_deposit'
    AND (p_payload ? 'planned_contribution_amount_centavos' OR p_payload ? 'contribution_frequency' OR p_payload ? 'next_contribution_date')
    AND NOT (p_payload ?& ARRAY['planned_contribution_amount_centavos', 'contribution_frequency', 'next_contribution_date']) THEN
    RAISE EXCEPTION 'savings contribution schedule is incomplete';
  END IF;
  IF p_payload ? 'contribution_frequency' AND p_payload->>'contribution_frequency' NOT IN ('weekly', 'biweekly', 'semi_monthly', 'monthly', 'quarterly', 'yearly', 'custom') THEN
    RAISE EXCEPTION 'invalid savings contribution frequency';
  END IF;
  SELECT EXISTS(SELECT 1 FROM applied_operations WHERE operation_id = p_operation_id AND user_id = auth.uid()) INTO v_previous;
  SELECT COALESCE(array_agg(field), ARRAY[]::text[]) INTO v_base_fields
  FROM unnest(COALESCE(p_changed_fields, ARRAY[]::text[])) AS field
  WHERE NOT (field = ANY(v_schedule_fields));
  SELECT * INTO v_result FROM private.apply_savings_account_detail_sync_operation(
    p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version,
    CASE WHEN p_operation_type = 'create' THEN p_changed_fields ELSE v_base_fields END,
    p_payload
  );
  IF v_previous OR v_result.status <> 'applied' OR p_operation_type = 'delete' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;
  UPDATE savings_account_details SET
    planned_contribution_amount_centavos = CASE WHEN p_operation_type = 'create' OR 'planned_contribution_amount_centavos' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'planned_contribution_amount_centavos', '')::bigint ELSE planned_contribution_amount_centavos END,
    contribution_frequency = CASE WHEN p_operation_type = 'create' OR 'contribution_frequency' = ANY(p_changed_fields) THEN p_payload->>'contribution_frequency' ELSE contribution_frequency END,
    contribution_interval_count = CASE WHEN p_operation_type = 'create' OR 'contribution_interval_count' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'contribution_interval_count', '')::integer ELSE contribution_interval_count END,
    contribution_day_of_month = CASE WHEN p_operation_type = 'create' OR 'contribution_day_of_month' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'contribution_day_of_month', '')::integer ELSE contribution_day_of_month END,
    contribution_second_day_of_month = CASE WHEN p_operation_type = 'create' OR 'contribution_second_day_of_month' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'contribution_second_day_of_month', '')::integer ELSE contribution_second_day_of_month END,
    contribution_day_of_week = CASE WHEN p_operation_type = 'create' OR 'contribution_day_of_week' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'contribution_day_of_week', '')::integer ELSE contribution_day_of_week END,
    custom_interval_days = CASE WHEN p_operation_type = 'create' OR 'custom_interval_days' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'custom_interval_days', '')::integer ELSE custom_interval_days END,
    next_contribution_date = CASE WHEN p_operation_type = 'create' OR 'next_contribution_date' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'next_contribution_date', '')::date ELSE next_contribution_date END
  WHERE account_id = p_record_id AND user_id = auth.uid();
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_sync_operation_before_savings_account_contribution_schedule;

CREATE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF p_entity = 'savings_account_details' THEN
    RETURN QUERY SELECT * FROM private.apply_savings_account_contribution_schedule_sync_operation(p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.apply_sync_operation_before_savings_account_contribution_schedule(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
END;
$$;

REVOKE EXECUTE ON FUNCTION private.apply_savings_account_contribution_schedule_sync_operation(uuid, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
