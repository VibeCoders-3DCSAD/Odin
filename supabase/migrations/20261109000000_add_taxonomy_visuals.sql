-- Persist a constrained visual identity for every category and subcategory.
ALTER TABLE hfce_category_defaults
  ADD COLUMN icon_key text NOT NULL DEFAULT 'tag',
  ADD COLUMN color_hex text NOT NULL DEFAULT '#0F766E';

ALTER TABLE hfce_subcategory_defaults
  ADD COLUMN icon_key text NOT NULL DEFAULT 'tag',
  ADD COLUMN color_hex text NOT NULL DEFAULT '#0F766E';

ALTER TABLE categories
  ADD COLUMN icon_key text NOT NULL DEFAULT 'tag',
  ADD COLUMN color_hex text NOT NULL DEFAULT '#0F766E',
  ADD CONSTRAINT categories_icon_key_chk CHECK (icon_key IN ('bowl-food', 'wine', 't-shirt', 'house', 'armchair', 'first-aid', 'car', 'device-mobile', 'game-controller', 'graduation-cap', 'fork-knife', 'sparkle', 'tag')),
  ADD CONSTRAINT categories_color_hex_chk CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE subcategories
  ADD COLUMN icon_key text NOT NULL DEFAULT 'tag',
  ADD COLUMN color_hex text NOT NULL DEFAULT '#0F766E',
  ADD CONSTRAINT subcategories_icon_key_chk CHECK (icon_key IN ('bowl-food', 'wine', 't-shirt', 'house', 'armchair', 'first-aid', 'car', 'device-mobile', 'game-controller', 'graduation-cap', 'fork-knife', 'sparkle', 'tag')),
  ADD CONSTRAINT subcategories_color_hex_chk CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$');

UPDATE hfce_category_defaults
SET icon_key = CASE slug
  WHEN 'food' THEN 'bowl-food'
  WHEN 'alcohol_tobacco' THEN 'wine'
  WHEN 'clothing_footwear' THEN 't-shirt'
  WHEN 'housing_water_utilities' THEN 'house'
  WHEN 'furnishings_household' THEN 'armchair'
  WHEN 'health' THEN 'first-aid'
  WHEN 'transport' THEN 'car'
  WHEN 'communication' THEN 'device-mobile'
  WHEN 'recreation_culture' THEN 'game-controller'
  WHEN 'education' THEN 'graduation-cap'
  WHEN 'restaurants_hotels' THEN 'fork-knife'
  WHEN 'miscellaneous_goods_services' THEN 'sparkle'
  ELSE 'tag'
END,
color_hex = CASE slug
  WHEN 'food' THEN '#E86A33'
  WHEN 'alcohol_tobacco' THEN '#C2410C'
  WHEN 'clothing_footwear' THEN '#D97706'
  WHEN 'housing_water_utilities' THEN '#A16207'
  WHEN 'furnishings_household' THEN '#4D7C0F'
  WHEN 'health' THEN '#15803D'
  WHEN 'transport' THEN '#0F766E'
  WHEN 'communication' THEN '#0E7490'
  WHEN 'recreation_culture' THEN '#2563EB'
  WHEN 'education' THEN '#7C3AED'
  WHEN 'restaurants_hotels' THEN '#C026D3'
  WHEN 'miscellaneous_goods_services' THEN '#BE123C'
  ELSE '#0F766E'
END;

UPDATE hfce_subcategory_defaults AS subcategory
SET icon_key = category.icon_key,
    color_hex = category.color_hex
FROM hfce_category_defaults AS category
WHERE category.slug = subcategory.category_slug;

UPDATE categories AS category
SET icon_key = defaults.icon_key,
    color_hex = defaults.color_hex,
    updated_at = now(),
    version = category.version + 1
FROM hfce_category_defaults AS defaults
WHERE category.user_id IS NOT NULL
  AND category.slug = defaults.slug
  AND category.deleted = false;

UPDATE subcategories AS subcategory
SET icon_key = defaults.icon_key,
    color_hex = defaults.color_hex,
    updated_at = now(),
    version = subcategory.version + 1
FROM hfce_subcategory_defaults AS defaults
WHERE subcategory.user_id IS NOT NULL
  AND subcategory.slug = defaults.slug
  AND subcategory.deleted = false;

CREATE OR REPLACE FUNCTION seed_hfce_taxonomy_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO categories (
    user_id, slug, label, short_label, description, icon_key, color_hex,
    is_system, is_filipino_context, classification, sort_order
  )
  SELECT
    p_user_id, defaults.slug, defaults.label, defaults.short_label,
    defaults.description, defaults.icon_key, defaults.color_hex, false,
    defaults.is_filipino_context, defaults.classification, defaults.sort_order
  FROM hfce_category_defaults AS defaults
  ON CONFLICT (user_id, slug) WHERE user_id IS NOT NULL DO NOTHING;

  INSERT INTO subcategories (
    category_id, user_id, slug, kind, label, short_label, description,
    icon_key, color_hex, is_system, is_filipino_context,
    is_protected_default, is_protected, minimum_amount_centavos,
    always_in_budget, fixed_amount_centavos, sort_order
  )
  SELECT
    category.id, p_user_id, defaults.slug, defaults.kind, defaults.label,
    defaults.short_label, defaults.description, defaults.icon_key,
    defaults.color_hex, false, defaults.is_filipino_context, false, false,
    defaults.minimum_amount_centavos, defaults.always_in_budget,
    defaults.fixed_amount_centavos, defaults.sort_order
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

CREATE OR REPLACE FUNCTION private.apply_taxonomy_visual_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result record;
  v_version integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity = 'categories' AND p_operation_type = 'create' THEN
    SELECT * INTO v_result FROM private.apply_category_create_sync_operation(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
  ELSE
    SELECT * INTO v_result FROM private.apply_sync_operation_ledger_core(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
  END IF;

  IF v_result.status <> 'applied' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;

  IF p_entity = 'categories' THEN
    UPDATE categories
    SET icon_key = CASE WHEN p_payload ? 'icon_key' THEN p_payload->>'icon_key' ELSE icon_key END,
        color_hex = CASE WHEN p_payload ? 'color_hex' THEN p_payload->>'color_hex' ELSE color_hex END,
        updated_at = now(),
        version = version + 1
    WHERE id = p_record_id AND user_id = v_user_id
    RETURNING version INTO v_version;
  ELSE
    UPDATE subcategories
    SET icon_key = CASE WHEN p_payload ? 'icon_key' THEN p_payload->>'icon_key' ELSE icon_key END,
        color_hex = CASE WHEN p_payload ? 'color_hex' THEN p_payload->>'color_hex' ELSE color_hex END,
        updated_at = now(),
        version = version + 1
    WHERE id = p_record_id AND user_id = v_user_id
    RETURNING version INTO v_version;
  END IF;

  UPDATE applied_operations
  SET result = jsonb_build_object('status', 'applied', 'current_version', v_version, 'taxonomy_visuals_applied', true)
  WHERE operation_id = p_operation_id AND user_id = v_user_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_version, v_result.conflicted_fields;
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
  IF p_entity IN ('categories', 'subcategories')
     AND (p_payload ? 'icon_key' OR p_payload ? 'color_hex') THEN
    RETURN QUERY SELECT * FROM private.apply_taxonomy_visual_sync_operation(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;

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
