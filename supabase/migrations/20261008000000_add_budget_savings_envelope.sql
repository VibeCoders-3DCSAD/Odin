ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS savings_budget_amount_centavos bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION apply_budget_sync_operation_v2(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_result record; v_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN RAISE EXCEPTION 'invalid device id'; END IF;
  IF octet_length(p_payload::text) > 256000 THEN RAISE EXCEPTION 'budget payload is too large'; END IF;
  IF jsonb_array_length(COALESCE(p_payload->'allocations', '[]'::jsonb)) > 100 THEN RAISE EXCEPTION 'budget allocations are limited to 100 items'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_payload->'allocations', '[]'::jsonb)) item WHERE jsonb_typeof(item) <> 'object' OR (item->>'amountMinor') !~ '^[1-9][0-9]*$' OR ((item->>'categoryId') IS NULL AND (item->>'subcategoryId') IS NULL) OR ((item->>'categoryId') IS NOT NULL AND (item->>'subcategoryId') IS NOT NULL)) THEN RAISE EXCEPTION 'budget allocations are invalid'; END IF;
  IF p_payload ? 'debtBudgetAmountMinor' AND (p_payload->>'debtBudgetAmountMinor') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'debt budget must be a non-negative integer'; END IF;
  IF p_payload ? 'savingsBudgetAmountMinor' AND (p_payload->>'savingsBudgetAmountMinor') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'savings budget must be a non-negative integer'; END IF;
  IF p_payload ? 'debtBudgetAmountMinor' AND (p_payload->>'debtBudgetAmountMinor')::numeric > 9223372036854775807 THEN RAISE EXCEPTION 'debt budget is too large'; END IF;
  IF p_payload ? 'savingsBudgetAmountMinor' AND (p_payload->>'savingsBudgetAmountMinor')::numeric > 9223372036854775807 THEN RAISE EXCEPTION 'savings budget is too large'; END IF;
  IF p_payload ? 'periodKind' AND p_payload->>'periodKind' <> 'MONTHLY' AND COALESCE(p_payload->>'debtBudgetAmountMinor', '0') <> '0' THEN RAISE EXCEPTION 'debt budget requires a monthly budget'; END IF;
  IF p_payload ? 'totalAmountMinor' AND p_payload->>'totalAmountMinor' !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'budget total must be a positive integer'; END IF;
  IF p_payload ? 'periodKind' AND p_payload->>'periodKind' NOT IN ('WEEKLY', 'MONTHLY', 'CUSTOM', 'INCOME_CYCLE') THEN RAISE EXCEPTION 'budget period kind is invalid'; END IF;
  IF p_payload ? 'periodStart' AND p_payload->>'periodStart' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'period start must be a date'; END IF;
  IF p_payload ? 'periodEnd' AND p_payload->>'periodEnd' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'period end must be a date'; END IF;
  IF p_payload ? 'periodStart' AND p_payload ? 'periodEnd' AND (p_payload->>'periodStart')::date > (p_payload->>'periodEnd')::date THEN RAISE EXCEPTION 'period end must be on or after start'; END IF;
  IF p_payload ? 'budget_period_days' AND (p_payload->>'budget_period_days') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'budget period days must be positive'; END IF;
  SELECT COALESCE(SUM((item->>'amountMinor')::numeric), 0) INTO v_total FROM jsonb_array_elements(COALESCE(p_payload->'allocations', '[]'::jsonb)) item;
  IF p_payload ? 'totalAmountMinor' AND v_total + COALESCE((p_payload->>'debtBudgetAmountMinor')::numeric, 0) + COALESCE((p_payload->>'savingsBudgetAmountMinor')::numeric, 0) > (p_payload->>'totalAmountMinor')::numeric THEN RAISE EXCEPTION 'allocations, debt budget, and savings budget cannot exceed total'; END IF;
  SELECT * INTO v_result FROM apply_budget_sync_operation(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
  IF v_result.status = 'applied' AND p_operation_type IN ('create', 'update') THEN
    UPDATE budgets SET
      debt_budget_amount_centavos = COALESCE((p_payload->>'debtBudgetAmountMinor')::bigint, debt_budget_amount_centavos),
      savings_budget_amount_centavos = COALESCE((p_payload->>'savingsBudgetAmountMinor')::bigint, savings_budget_amount_centavos),
      updated_at = now()
    WHERE id = p_record_id AND user_id = auth.uid();
  END IF;
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;
