-- HFCE defaults are reference data only. Each account receives its own
-- editable categories and subcategories, keeping taxonomy IDs user-scoped.
CREATE TABLE hfce_category_defaults (
  slug text PRIMARY KEY,
  label text NOT NULL,
  short_label text,
  description text NOT NULL,
  is_filipino_context boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE hfce_category_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_read_available ON categories;
CREATE POLICY categories_owner_read
  ON categories FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS subcategories_read_available ON subcategories;
CREATE POLICY subcategories_owner_read
  ON subcategories FOR SELECT
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION enforce_user_owned_taxonomy_references()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'subcategories' AND NEW.category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM categories
      WHERE id = NEW.category_id
        AND user_id = NEW.user_id
        AND deleted = false
    ) THEN
      RAISE EXCEPTION 'subcategory category must belong to the same user';
    END IF;
  ELSIF TG_TABLE_NAME = 'transactions' AND NEW.subcategory_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM subcategories
      WHERE id = NEW.subcategory_id
        AND user_id = NEW.user_id
        AND deleted = false
    ) THEN
      RAISE EXCEPTION 'transaction subcategory must belong to the same user';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subcategories_user_owned_category ON subcategories;
CREATE TRIGGER subcategories_user_owned_category
  BEFORE INSERT OR UPDATE OF category_id, user_id ON subcategories
  FOR EACH ROW EXECUTE FUNCTION enforce_user_owned_taxonomy_references();

DROP TRIGGER IF EXISTS transactions_user_owned_subcategory ON transactions;
CREATE TRIGGER transactions_user_owned_subcategory
  BEFORE INSERT OR UPDATE OF subcategory_id, user_id ON transactions
  FOR EACH ROW EXECUTE FUNCTION enforce_user_owned_taxonomy_references();

INSERT INTO hfce_category_defaults (
  slug,
  label,
  short_label,
  description,
  is_filipino_context,
  sort_order
)
SELECT
  category.slug,
  category.label,
  category.short_label,
  category.description,
  category.is_filipino_context,
  category.sort_order
FROM categories AS category
JOIN category_groups AS category_group ON category_group.id = category.category_group_id
WHERE category_group.slug = 'hfce_categories'
  AND category.user_id IS NULL
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label,
    short_label = EXCLUDED.short_label,
    description = EXCLUDED.description,
    is_filipino_context = EXCLUDED.is_filipino_context,
    sort_order = EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION seed_hfce_taxonomy_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO categories (
    category_group_id,
    user_id,
    slug,
    label,
    short_label,
    description,
    is_system,
    is_filipino_context,
    sort_order
  )
  SELECT
    category_group.id,
    p_user_id,
    defaults.slug,
    defaults.label,
    defaults.short_label,
    defaults.description,
    false,
    defaults.is_filipino_context,
    defaults.sort_order
  FROM hfce_category_defaults AS defaults
  JOIN category_groups AS category_group ON category_group.slug = 'hfce_categories'
  WHERE category_group.is_active = true
  ON CONFLICT (user_id, slug) WHERE user_id IS NOT NULL DO NOTHING;

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

-- Keep the previous function name valid for any callers added before this
-- consolidation, while routing all provisioning through the full taxonomy seed.
CREATE OR REPLACE FUNCTION seed_hfce_subcategories_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_hfce_taxonomy_for_user(p_user_id);
END;
$$;

SELECT seed_hfce_taxonomy_for_user(profile.user_id)
FROM profiles AS profile;

UPDATE budget_allocations AS allocation
SET category_id = category.id,
    updated_at = now(),
    version = allocation.version + 1
FROM budgets AS budget
JOIN categories AS legacy_category ON true
JOIN categories AS category ON true
WHERE allocation.budget_id = budget.id
  AND legacy_category.id = allocation.category_id
  AND category.user_id = budget.user_id
  AND category.slug = legacy_category.slug
  AND category.deleted = false
  AND legacy_category.user_id IS NULL;

UPDATE alert_suppression_rules AS rule
SET category_id = category.id,
    updated_at = now(),
    version = rule.version + 1
FROM categories AS legacy_category
JOIN categories AS category ON true
WHERE rule.category_id = legacy_category.id
  AND category.user_id = rule.user_id
  AND category.slug = legacy_category.slug
  AND category.deleted = false
  AND legacy_category.user_id IS NULL;

UPDATE categories AS category
SET is_active = false,
    deleted = true,
    updated_at = now(),
    version = category.version + 1
FROM category_groups AS category_group
WHERE category.category_group_id = category_group.id
  AND category_group.slug = 'hfce_categories'
  AND category.user_id IS NULL;

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

  PERFORM seed_hfce_taxonomy_for_user(NEW.id);

  RETURN NEW;
END;
$$;
