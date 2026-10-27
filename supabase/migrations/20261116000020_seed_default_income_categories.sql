-- Income defaults are reference data only. Each account receives its own
-- editable income subcategories, which have no parent category.
CREATE TABLE income_subcategory_defaults (
  slug text PRIMARY KEY,
  label text NOT NULL,
  short_label text,
  description text NOT NULL,
  icon_key text NOT NULL,
  color_hex text NOT NULL,
  is_filipino_context boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE income_subcategory_defaults ENABLE ROW LEVEL SECURITY;

INSERT INTO income_subcategory_defaults (
  slug, label, short_label, description, icon_key, color_hex,
  is_filipino_context, sort_order
) VALUES
  ('income_salary', 'Salary', 'Salary', 'Regular take-home pay from employment.', 'wallet', '#15803D', false, 10),
  ('income_freelance', 'Raket & Freelance', 'Raket', 'Sidelines, gigs, commissions, and project work.', 'laptop', '#0F766E', true, 20),
  ('income_remittance', 'Padala', 'Padala', 'Money sent by OFW or other family members.', 'airplane', '#0E7490', true, 30),
  ('income_business', 'Business Income', 'Business', 'Sari-sari store, online selling, and reselling.', 'storefront', '#2563EB', false, 40),
  ('income_13th_month_bonus', '13th Month & Bonuses', 'Bonuses', '13th month pay, mid-year bonus, and incentives.', 'trophy', '#7C3AED', true, 50),
  ('income_rental', 'Paupahan', 'Paupahan', 'Rent from rooms, boarding houses, or parking.', 'key', '#A16207', true, 60),
  ('income_tips', 'Tips & Service Charge', 'Tips', 'Tips and service charge shares from customers.', 'heart', '#C026D3', false, 70),
  ('income_interest_investments', 'Interest & Investments', 'Interest', 'Bank interest, MP2 dividends, and investment returns.', 'bank', '#4D7C0F', false, 80),
  ('income_benefits', 'Government Benefits', 'Benefits', 'SSS, GSIS, PhilHealth, 4Ps, and pension payouts.', 'shield-check', '#0369A1', true, 90),
  ('income_regalo', 'Regalo & Allowance', 'Regalo', 'Pamasko, baon, and cash gifts from events.', 'gift', '#BE123C', true, 100),
  ('income_benta', 'Benta ng Gamit', 'Benta', 'Selling preloved items, gadgets, or ukay finds.', 'tag', '#D97706', true, 110),
  ('income_other', 'Other Income', 'Other', 'Income that does not fit another category.', 'sparkle', '#475569', false, 999);

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

  -- Skip defaults whose label the user already has as a live income category.
  INSERT INTO subcategories (
    category_id, user_id, slug, kind, label, short_label, description,
    icon_key, color_hex, is_system, is_filipino_context, sort_order
  )
  SELECT
    NULL, p_user_id, defaults.slug, 'income', defaults.label,
    defaults.short_label, defaults.description, defaults.icon_key,
    defaults.color_hex, false, defaults.is_filipino_context, defaults.sort_order
  FROM income_subcategory_defaults AS defaults
  WHERE NOT EXISTS (
    SELECT 1
    FROM subcategories AS existing
    WHERE existing.user_id = p_user_id
      AND existing.kind = 'income'
      AND existing.deleted = false
      AND lower(btrim(existing.label)) = lower(defaults.label)
  )
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

SELECT seed_hfce_taxonomy_for_user(profile.user_id)
FROM profiles AS profile;
