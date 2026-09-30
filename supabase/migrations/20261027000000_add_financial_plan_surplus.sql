ALTER TABLE public.financial_plans
  ADD COLUMN IF NOT EXISTS debt_surplus_centavos bigint NOT NULL DEFAULT 0 CHECK (debt_surplus_centavos >= 0),
  ADD COLUMN IF NOT EXISTS savings_surplus_centavos bigint NOT NULL DEFAULT 0 CHECK (savings_surplus_centavos >= 0);

ALTER FUNCTION public.apply_financial_plan_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_financial_plan_sync_operation_base;

CREATE FUNCTION public.apply_financial_plan_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_result record;
BEGIN
  SELECT * INTO v_result
    FROM public.apply_financial_plan_sync_operation_base(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );

  IF v_result.status IN ('applied', 'duplicate') THEN
    UPDATE public.financial_plans
       SET debt_surplus_centavos = COALESCE((p_payload->'recommendation'->>'debtSurplusCentavos')::bigint, 0),
           savings_surplus_centavos = COALESCE((p_payload->'recommendation'->>'savingsSurplusCentavos')::bigint, 0)
     WHERE id = p_record_id AND user_id = auth.uid();
  END IF;

  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_financial_plan_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_financial_plan_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
