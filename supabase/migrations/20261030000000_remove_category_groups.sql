-- Categories are the HFCE top level. The former group layer no longer has
-- business meaning, so remove it without changing category or subcategory IDs.
CREATE OR REPLACE FUNCTION seed_hfce_taxonomy_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO categories (
    user_id, slug, label, short_label, description, is_system,
    is_filipino_context, sort_order
  )
  SELECT
    p_user_id, defaults.slug, defaults.label, defaults.short_label,
    defaults.description, false, defaults.is_filipino_context,
    defaults.sort_order
  FROM hfce_category_defaults AS defaults
  ON CONFLICT (user_id, slug) WHERE user_id IS NOT NULL DO NOTHING;

  INSERT INTO subcategories (
    category_id, user_id, slug, kind, label, short_label, description,
    is_system, is_filipino_context, is_protected_default, is_protected,
    minimum_amount_centavos, always_in_budget, fixed_amount_centavos, sort_order
  )
  SELECT
    category.id, p_user_id, defaults.slug, defaults.kind, defaults.label,
    defaults.short_label, defaults.description, false,
    defaults.is_filipino_context, false, false, defaults.minimum_amount_centavos,
    defaults.always_in_budget, defaults.fixed_amount_centavos, defaults.sort_order
  FROM hfce_subcategory_defaults AS defaults
  JOIN categories AS category
    ON category.user_id = p_user_id
   AND category.slug = defaults.category_slug
   AND category.deleted = false
   AND category.is_active = true
  ON CONFLICT (user_id, slug) WHERE user_id IS NOT NULL DO NOTHING;

  UPDATE subcategories AS subcategory
  SET category_id = category.id,
      updated_at = now(),
      version = subcategory.version + 1
  FROM hfce_subcategory_defaults AS defaults
  JOIN categories AS category
    ON category.user_id = p_user_id
   AND category.slug = defaults.category_slug
   AND category.deleted = false
  WHERE subcategory.user_id = p_user_id
    AND subcategory.slug = defaults.slug
    AND subcategory.category_id IS DISTINCT FROM category.id;
END;
$$;

CREATE OR REPLACE FUNCTION private.apply_category_create_sync_operation(
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
  v_existing_user_id uuid;
  v_existing_result jsonb;
  v_now timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;
  IF p_entity <> 'categories' OR p_operation_type <> 'create' THEN RAISE EXCEPTION 'invalid category create operation'; END IF;

  INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
  ON CONFLICT (operation_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT user_id, result INTO v_existing_user_id, v_existing_result FROM applied_operations WHERE operation_id = p_operation_id;
    IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
    ELSE
      RETURN QUERY SELECT COALESCE(v_existing_result->>'status', 'duplicate')::text, NULLIF(v_existing_result->>'reason', '')::text, (v_existing_result->>'current_version')::integer, NULL::text[];
    END IF;
    RETURN;
  END IF;

  INSERT INTO categories (
    id, user_id, slug, label, short_label, description, is_system,
    is_filipino_context, minimum_amount_centavos, always_in_budget,
    fixed_amount_centavos, sort_order, is_active, metadata, updated_at,
    version, deleted
  ) VALUES (
    p_record_id, v_user_id, p_payload->>'slug', p_payload->>'label',
    p_payload->>'short_label', p_payload->>'description', false,
    COALESCE((p_payload->>'is_filipino_context')::boolean, false),
    (p_payload->>'minimum_amount_centavos')::bigint,
    COALESCE((p_payload->>'always_in_budget')::boolean, false),
    (p_payload->>'fixed_amount_centavos')::bigint,
    COALESCE((p_payload->>'sort_order')::integer, 0), true, '{}'::jsonb,
    v_now, 1, false
  );

  INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
  VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'applied', jsonb_build_object('base_version', p_base_version, 'new_version', 1, 'fields', to_jsonb(p_changed_fields)));
  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', 1) WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
BEGIN
  IF p_entity = 'categories' AND p_operation_type = 'create' THEN
    RETURN QUERY SELECT * FROM private.apply_category_create_sync_operation(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;

  IF p_entity = 'subcategories'
     AND (p_payload ? 'minimum_amount_centavos' OR p_payload ? 'always_in_budget' OR p_payload ? 'fixed_amount_centavos') THEN
    RETURN QUERY SELECT * FROM private.apply_subcategory_budget_config_sync_operation(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM private.apply_sync_operation_ledger_core(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
END;
$$;

ALTER TABLE categories DROP COLUMN category_group_id;
DROP TABLE category_groups;
