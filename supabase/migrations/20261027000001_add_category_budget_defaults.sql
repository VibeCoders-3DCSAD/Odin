ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS minimum_amount_centavos bigint,
  ADD COLUMN IF NOT EXISTS always_in_budget boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fixed_amount_centavos bigint,
  ADD CONSTRAINT categories_fixed_amount_nonnegative_chk CHECK (fixed_amount_centavos IS NULL OR fixed_amount_centavos >= 0),
  ADD CONSTRAINT categories_fixed_amount_minimum_chk CHECK (fixed_amount_centavos IS NULL OR minimum_amount_centavos IS NULL OR fixed_amount_centavos >= minimum_amount_centavos);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  ADD CONSTRAINT transactions_category_target_chk CHECK ((category_id IS NULL) OR subcategory_id IS NULL);

CREATE OR REPLACE FUNCTION private.apply_category_budget_config_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid, p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE v_user_id uuid := auth.uid(); v_result record; v_version integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO v_result FROM private.apply_sync_operation_ledger_core(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
  IF v_result.status <> 'applied' THEN RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields; RETURN; END IF;
  UPDATE categories SET minimum_amount_centavos = CASE WHEN p_payload ? 'minimum_amount_centavos' THEN NULLIF(p_payload->>'minimum_amount_centavos', '')::bigint ELSE minimum_amount_centavos END, always_in_budget = CASE WHEN p_payload ? 'always_in_budget' THEN (p_payload->>'always_in_budget')::boolean ELSE always_in_budget END, fixed_amount_centavos = CASE WHEN p_payload ? 'fixed_amount_centavos' THEN NULLIF(p_payload->>'fixed_amount_centavos', '')::bigint ELSE fixed_amount_centavos END, version = version + 1, updated_at = now() WHERE id = p_record_id AND user_id = v_user_id RETURNING version INTO v_version;
  IF v_version IS NULL THEN RAISE EXCEPTION 'category not found for budget configuration update'; END IF;
  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_version, 'category_budget_config_applied', true) WHERE operation_id = p_operation_id AND user_id = v_user_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_version, v_result.conflicted_fields;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid, p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF p_entity = 'categories' AND (p_payload ? 'minimum_amount_centavos' OR p_payload ? 'always_in_budget' OR p_payload ? 'fixed_amount_centavos') THEN
    RETURN QUERY SELECT * FROM private.apply_category_budget_config_sync_operation(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload); RETURN;
  END IF;
  IF p_entity = 'subcategories' AND (p_payload ? 'minimum_amount_centavos' OR p_payload ? 'always_in_budget' OR p_payload ? 'fixed_amount_centavos') THEN
    RETURN QUERY SELECT * FROM private.apply_subcategory_budget_config_sync_operation(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload); RETURN;
  END IF;
  RETURN QUERY SELECT * FROM private.apply_sync_operation_ledger_core(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
END;
$$;
