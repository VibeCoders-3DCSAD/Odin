CREATE OR REPLACE FUNCTION apply_budget_sync_operation(
  p_operation_id uuid,
  p_device_id text,
  p_entity text,
  p_record_id uuid,
  p_operation_type text,
  p_base_version integer,
  p_changed_fields text[],
  p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_version integer;
  v_deleted boolean;
  v_item jsonb;
  v_subcategory_id uuid;
  v_category_id uuid;
  v_allocation_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity <> 'budgets' THEN RAISE EXCEPTION 'entity % is not a budget entity', p_entity; END IF;
  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN
    RAISE EXCEPTION 'budget operation_type % is not supported', p_operation_type;
  END IF;

  INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type,
    jsonb_build_object('status', 'pending'))
  ON CONFLICT (operation_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  IF p_operation_type = 'create' THEN
    IF p_payload->>'status' <> 'draft' OR p_payload->>'allocation_method' <> 'MANUAL' THEN
      RAISE EXCEPTION 'only manual draft budgets can sync in Phase 3b.1';
    END IF;
    IF (p_payload->>'totalAmountMinor')::bigint <= 0 THEN RAISE EXCEPTION 'total amount must be positive'; END IF;

    INSERT INTO budgets (
      id, user_id, status, source, period_kind, period_start, period_end,
      budget_period_days, total_amount_centavos, surplus_handling, deficit_handling,
      allow_deficit_planning, metadata, updated_at
    ) VALUES (
      p_record_id, v_user_id, 'draft', 'manual',
      CASE p_payload->>'periodKind'
        WHEN 'WEEKLY' THEN 'weekly'::odin_budget_period_kind
        WHEN 'MONTHLY' THEN 'monthly'::odin_budget_period_kind
        WHEN 'CUSTOM' THEN 'custom'::odin_budget_period_kind
        WHEN 'INCOME_CYCLE' THEN 'income_cycle'::odin_budget_period_kind
      END,
      (p_payload->>'periodStart')::date, (p_payload->>'periodEnd')::date,
      (p_payload->>'budget_period_days')::integer,
      (p_payload->>'totalAmountMinor')::bigint,
      'no_action', 'warn_only', false, '{}'::jsonb, now()
    );

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'allocations', '[]'::jsonb)) LOOP
      v_subcategory_id := NULLIF(v_item->>'subcategoryId', '')::uuid;
      v_category_id := NULLIF(v_item->>'categoryId', '')::uuid;
      IF v_subcategory_id IS NOT NULL THEN
        SELECT category_id INTO v_category_id FROM subcategories
        WHERE id = v_subcategory_id AND deleted = false AND is_active = true
          AND (user_id IS NULL OR user_id = v_user_id) AND kind = 'expense';
      END IF;
      IF v_category_id IS NULL THEN RAISE EXCEPTION 'allocation category is not accessible'; END IF;
      IF v_subcategory_id IS NULL THEN
        PERFORM 1 FROM categories WHERE id = v_category_id AND deleted = false AND is_active = true
          AND (user_id IS NULL OR user_id = v_user_id);
        IF NOT FOUND THEN RAISE EXCEPTION 'allocation category is not accessible'; END IF;
      END IF;
      v_allocation_id := NULLIF(v_item->>'id', '')::uuid;
      IF v_allocation_id IS NULL THEN v_allocation_id := gen_random_uuid(); END IF;
      INSERT INTO budget_allocations (
        id, user_id, budget_id, allocation_scope, category_id, subcategory_id,
        allocated_amount_centavos, is_protected_snapshot, metadata
      ) VALUES (
        v_allocation_id, v_user_id, p_record_id,
        CASE WHEN v_subcategory_id IS NULL THEN 'category' ELSE 'subcategory' END::odin_allocation_scope,
        v_category_id, v_subcategory_id, (v_item->>'amountMinor')::bigint, false, '{}'::jsonb
      );
    END LOOP;
  ELSIF p_operation_type = 'update' THEN
    SELECT version, deleted INTO v_current_version, v_deleted FROM budgets
    WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
    IF v_current_version IS NULL OR v_deleted THEN RAISE EXCEPTION 'budget not found or inaccessible'; END IF;
    IF p_base_version IS NOT NULL AND p_base_version <> v_current_version THEN
      UPDATE applied_operations SET result = jsonb_build_object(
        'status', 'conflict', 'current_version', v_current_version,
        'conflicted_fields', to_jsonb(p_changed_fields)
      ) WHERE operation_id = p_operation_id;
      RETURN QUERY SELECT 'conflict'::text, 'budget version changed'::text, v_current_version, p_changed_fields;
      RETURN;
    END IF;
    UPDATE budgets SET
      period_kind = CASE p_payload->>'periodKind'
        WHEN 'WEEKLY' THEN 'weekly'::odin_budget_period_kind
        WHEN 'MONTHLY' THEN 'monthly'::odin_budget_period_kind
        WHEN 'CUSTOM' THEN 'custom'::odin_budget_period_kind
        WHEN 'INCOME_CYCLE' THEN 'income_cycle'::odin_budget_period_kind
      END,
      period_start = (p_payload->>'periodStart')::date,
      period_end = (p_payload->>'periodEnd')::date,
      budget_period_days = (p_payload->>'budget_period_days')::integer,
      total_amount_centavos = (p_payload->>'totalAmountMinor')::bigint,
      updated_at = now(), version = version + 1
    WHERE id = p_record_id AND user_id = v_user_id;
    UPDATE budget_allocations SET deleted = true, updated_at = now(), version = version + 1
    WHERE budget_id = p_record_id AND user_id = v_user_id AND deleted = false;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'allocations', '[]'::jsonb)) LOOP
      v_subcategory_id := NULLIF(v_item->>'subcategoryId', '')::uuid;
      v_category_id := NULLIF(v_item->>'categoryId', '')::uuid;
      IF v_subcategory_id IS NOT NULL THEN
        SELECT category_id INTO v_category_id FROM subcategories
        WHERE id = v_subcategory_id AND deleted = false AND is_active = true
          AND (user_id IS NULL OR user_id = v_user_id) AND kind = 'expense';
      END IF;
      IF v_category_id IS NULL THEN RAISE EXCEPTION 'allocation category is not accessible'; END IF;
      IF v_subcategory_id IS NULL THEN
        PERFORM 1 FROM categories WHERE id = v_category_id AND deleted = false AND is_active = true
          AND (user_id IS NULL OR user_id = v_user_id);
        IF NOT FOUND THEN RAISE EXCEPTION 'allocation category is not accessible'; END IF;
      END IF;
      v_allocation_id := NULLIF(v_item->>'id', '')::uuid;
      IF v_allocation_id IS NULL THEN v_allocation_id := gen_random_uuid(); END IF;
      INSERT INTO budget_allocations (
        id, user_id, budget_id, allocation_scope, category_id, subcategory_id,
        allocated_amount_centavos, is_protected_snapshot, metadata
      ) VALUES (
        v_allocation_id, v_user_id, p_record_id,
        CASE WHEN v_subcategory_id IS NULL THEN 'category' ELSE 'subcategory' END::odin_allocation_scope,
        v_category_id, v_subcategory_id, (v_item->>'amountMinor')::bigint, false, '{}'::jsonb
      );
    END LOOP;
    v_current_version := v_current_version + 1;
  ELSE
    SELECT version, deleted INTO v_current_version, v_deleted FROM budgets
    WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
    IF v_current_version IS NULL THEN RAISE EXCEPTION 'budget not found or inaccessible'; END IF;
    IF NOT v_deleted THEN
      UPDATE budgets SET
        status = 'deleted',
        deleted = true,
        deleted_at = now(),
        updated_at = now(),
        version = version + 1
      WHERE id = p_record_id AND user_id = v_user_id;
    END IF;
  END IF;

  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', COALESCE(v_current_version, 1))
  WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, COALESCE(v_current_version, 1), NULL::text[];
END;
$$;

GRANT EXECUTE ON FUNCTION apply_budget_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  TO authenticated;
