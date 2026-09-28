-- The original HFCE system rows remain as retired reference data after the
-- per-user taxonomy migration. Rebuild the live defaults from that canonical
-- source, then seed any profile that did not receive them previously.
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
  AND category.user_id IS NULL
  AND subcategory.user_id IS NULL
ON CONFLICT (slug) DO UPDATE
SET category_slug = EXCLUDED.category_slug,
    kind = EXCLUDED.kind,
    label = EXCLUDED.label,
    short_label = EXCLUDED.short_label,
    description = EXCLUDED.description,
    is_filipino_context = EXCLUDED.is_filipino_context,
    sort_order = EXCLUDED.sort_order;

SELECT seed_hfce_subcategories_for_user(profile.user_id)
FROM profiles AS profile;
