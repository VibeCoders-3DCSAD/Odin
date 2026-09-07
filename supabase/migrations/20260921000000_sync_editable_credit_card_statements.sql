-- A statement operation is the sole synchronization owner of the matching
-- cycle date. This avoids a separate queued cycle update racing the statement.
CREATE OR REPLACE FUNCTION public.guard_credit_card_statement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff date;
BEGIN
  SELECT c.cutoff_date INTO v_cutoff
    FROM public.credit_card_cycles c
    JOIN public.financial_accounts a ON a.id = c.account_id AND a.user_id = c.user_id
   WHERE c.id = NEW.cycle_id AND c.user_id = NEW.user_id AND c.deleted = false
     AND a.kind = 'credit_card' AND a.deleted = false;
  IF v_cutoff IS NULL OR NEW.statement_date < v_cutoff THEN
    RAISE EXCEPTION 'credit-card statement date is invalid';
  END IF;
  IF NEW.authoritative = false THEN
    RAISE EXCEPTION 'recorded credit-card statements must remain authoritative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cycle uuid;
  v_statement_date date;
  v_result record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity = 'credit_card_details' THEN
    PERFORM set_config('odin.credit_card_invariant_path', 'true', true);
    SELECT * INTO v_result FROM public.apply_credit_card_sync_operation_v3(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    IF v_result.status = 'applied' AND p_operation_type IN ('create', 'update') THEN
      UPDATE public.credit_card_details d
         SET available_credit_centavos = d.credit_limit_centavos - COALESCE((
               SELECT SUM(t.amount_centavos - cct.applied_credit_centavos)
                 FROM public.credit_card_transactions cct
                 JOIN public.transactions t ON t.id = cct.transaction_id AND t.user_id = cct.user_id
                WHERE cct.user_id = d.user_id AND cct.account_id = d.account_id
                  AND cct.deleted = false AND t.deleted = false
             ), 0),
             version = version + 1,
             updated_at = now()
       WHERE d.account_id = p_record_id AND d.user_id = v_user AND d.deleted = false;
    END IF;
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;

  IF p_entity = 'credit_card_transactions' AND p_operation_type = 'create'
     AND NOT EXISTS (SELECT 1 FROM public.applied_operations WHERE operation_id = p_operation_id) THEN
    PERFORM set_config('odin.credit_card_invariant_path', 'true', true);
  END IF;

  IF p_entity <> 'credit_card_statements' THEN
    RETURN QUERY SELECT * FROM public.apply_credit_card_sync_operation_v3(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;

  IF p_operation_type NOT IN ('create', 'update') THEN
    RETURN QUERY SELECT 'rejected'::text, 'credit-card statements cannot be deleted'::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  IF p_operation_type = 'create' THEN
    v_cycle := NULLIF(p_payload->>'cycle_id', '')::uuid;
    p_payload := p_payload || jsonb_build_object('authoritative', true);
  ELSE
    SELECT cycle_id INTO v_cycle
      FROM public.credit_card_statements
     WHERE id = p_record_id AND user_id = v_user AND deleted = false;
  END IF;
  v_statement_date := NULLIF(p_payload->>'statement_date', '')::date;

  IF v_cycle IS NULL OR (v_statement_date IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.credit_card_cycles c
    JOIN public.financial_accounts a ON a.id = c.account_id AND a.user_id = c.user_id
     WHERE c.id = v_cycle AND c.user_id = v_user AND c.deleted = false
       AND a.kind = 'credit_card' AND a.deleted = false
       AND v_statement_date >= c.cutoff_date
  )) THEN
    RETURN QUERY SELECT 'rejected'::text, 'credit-card statement cycle is invalid'::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  SELECT * INTO v_result FROM public.apply_credit_card_sync_operation_v3(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
  IF v_result.status = 'applied' AND v_statement_date IS NOT NULL THEN
    UPDATE public.credit_card_cycles
       SET statement_date = v_statement_date, version = version + 1, updated_at = now()
     WHERE id = v_cycle AND user_id = v_user AND deleted = false;
  END IF;
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
