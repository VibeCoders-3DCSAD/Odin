-- HFCE categories are shared reference records. Their subcategories are
-- per-user records so a user's taxonomy edits never affect another account.
CREATE TABLE hfce_subcategory_defaults (
  category_slug text NOT NULL,
  slug text PRIMARY KEY,
  kind odin_subcategory_kind NOT NULL DEFAULT 'expense',
  label text NOT NULL,
  short_label text,
  description text NOT NULL,
  is_filipino_context boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE hfce_subcategory_defaults ENABLE ROW LEVEL SECURITY;

INSERT INTO hfce_subcategory_defaults (
  category_slug,
  slug,
  kind,
  label,
  short_label,
  description,
  is_filipino_context,
  sort_order
)
SELECT
  category.slug,
  subcategory.slug,
  subcategory.kind,
  subcategory.label,
  subcategory.short_label,
  subcategory.description,
  subcategory.is_filipino_context,
  subcategory.sort_order
FROM subcategories AS subcategory
JOIN categories AS category ON category.id = subcategory.category_id
JOIN category_groups AS category_group ON category_group.id = category.category_group_id
WHERE category_group.slug = 'hfce_categories'
  AND subcategory.user_id IS NULL
ON CONFLICT (slug) DO UPDATE
SET category_slug = EXCLUDED.category_slug,
    kind = EXCLUDED.kind,
    label = EXCLUDED.label,
    short_label = EXCLUDED.short_label,
    description = EXCLUDED.description,
    is_filipino_context = EXCLUDED.is_filipino_context,
    sort_order = EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION seed_hfce_subcategories_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO subcategories (
    category_id,
    user_id,
    slug,
    kind,
    label,
    short_label,
    description,
    is_system,
    is_filipino_context,
    is_protected_default,
    is_protected,
    sort_order
  )
  SELECT
    category.id,
    p_user_id,
    defaults.slug,
    defaults.kind,
    defaults.label,
    defaults.short_label,
    defaults.description,
    false,
    defaults.is_filipino_context,
    false,
    false,
    defaults.sort_order
  FROM hfce_subcategory_defaults AS defaults
  JOIN categories AS category ON category.slug = defaults.category_slug
  JOIN category_groups AS category_group ON category_group.id = category.category_group_id
  WHERE category_group.slug = 'hfce_categories'
    AND category.user_id IS NULL
    AND category.is_active = true
  ON CONFLICT (user_id, slug) WHERE user_id IS NOT NULL DO NOTHING;
END;
$$;

SELECT seed_hfce_subcategories_for_user(profile.user_id)
FROM profiles AS profile;

UPDATE subcategories AS subcategory
SET is_active = false,
    deleted = true,
    updated_at = now(),
    version = subcategory.version + 1
FROM categories AS category
JOIN category_groups AS category_group ON category_group.id = category.category_group_id
WHERE subcategory.category_id = category.id
  AND category_group.slug = 'hfce_categories'
  AND subcategory.user_id IS NULL;

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'display_name', '')), '')
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_privacy_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_eligibility_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM seed_hfce_subcategories_for_user(NEW.id);

  RETURN NEW;
END;
$$;
