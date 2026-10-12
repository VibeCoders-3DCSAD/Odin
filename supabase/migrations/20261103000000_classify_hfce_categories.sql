-- Categorize taxonomy defaults and user-owned categories so essential and
-- non-essential spending can be handled independently.
ALTER TABLE hfce_category_defaults
  ADD COLUMN classification text NOT NULL DEFAULT 'essential'
  CHECK (classification IN ('essential', 'non_essential'));

ALTER TABLE categories
  ADD COLUMN classification text NOT NULL DEFAULT 'essential'
  CHECK (classification IN ('essential', 'non_essential'));

UPDATE hfce_category_defaults
SET classification = 'non_essential'
WHERE slug IN (
  'alcohol_tobacco',
  'recreation_culture',
  'restaurants_hotels',
  'miscellaneous_goods_services'
);

UPDATE categories
SET classification = 'non_essential',
    updated_at = now(),
    version = version + 1
WHERE slug IN (
    'alcohol_tobacco',
    'recreation_culture',
    'restaurants_hotels',
    'miscellaneous_goods_services'
  )
  AND user_id IS NOT NULL
  AND deleted = false;

CREATE OR REPLACE FUNCTION seed_hfce_taxonomy_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO categories (
    user_id, slug, label, short_label, description, is_system,
    is_filipino_context, classification, sort_order
  )
  SELECT
    p_user_id, defaults.slug, defaults.label, defaults.short_label,
    defaults.description, false, defaults.is_filipino_context,
    defaults.classification, defaults.sort_order
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
