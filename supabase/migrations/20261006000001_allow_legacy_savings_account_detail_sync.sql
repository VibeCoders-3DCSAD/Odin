-- Savings-account details created before contribution schedules existed may
-- still be queued offline. Keep those records syncable while enforcing the
-- schedule contract whenever a schedule field is supplied.
ALTER TABLE public.savings_account_details
  DROP CONSTRAINT IF EXISTS savings_account_details_contribution_schedule_check;

ALTER TABLE public.savings_account_details
  ADD CONSTRAINT savings_account_details_contribution_schedule_check CHECK (
    account_type = 'time_deposit'
    OR contribution_frequency IS NULL
    OR (planned_contribution_amount_centavos >= 0
      AND next_contribution_date IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION private.apply_legacy_savings_account_detail_sync_operation(
  p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text,
  p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF p_operation_type = 'create'
    AND p_payload->>'account_type' <> 'time_deposit'
    AND NOT (p_payload ? 'planned_contribution_amount_centavos'
      OR p_payload ? 'contribution_frequency'
      OR p_payload ? 'next_contribution_date') THEN
    RETURN QUERY SELECT * FROM private.apply_savings_account_detail_sync_operation(
      p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version,
      p_changed_fields, p_payload
    );
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM private.apply_savings_account_contribution_schedule_sync_operation(
    p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version,
    p_changed_fields, p_payload
  );
END;
$$;

ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_sync_operation_before_legacy_savings_account_detail;

CREATE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF p_entity = 'savings_account_details' THEN
    RETURN QUERY SELECT * FROM private.apply_legacy_savings_account_detail_sync_operation(
      p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version,
      p_changed_fields, p_payload
    );
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.apply_sync_operation_before_legacy_savings_account_detail(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION private.apply_legacy_savings_account_detail_sync_operation(uuid, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
