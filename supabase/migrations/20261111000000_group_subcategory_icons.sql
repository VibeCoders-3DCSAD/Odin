-- Add category-specific choices to the persisted icon catalog.
ALTER TABLE categories
  DROP CONSTRAINT categories_icon_key_chk,
  ADD CONSTRAINT categories_icon_key_chk CHECK (icon_key IN (
    'bowl-food', 'wine', 't-shirt', 'house', 'armchair', 'first-aid',
    'car', 'device-mobile', 'game-controller', 'graduation-cap', 'fork-knife',
    'sparkle', 'tag', 'airplane', 'bank', 'basket', 'bus', 'camera', 'coffee',
    'credit-card', 'dog', 'gift', 'heart', 'laptop', 'music-note', 'storefront',
    'carrot', 'fish', 'bread', 'egg', 'cookie', 'orange', 'pill', 'stethoscope',
    'tooth', 'eye', 'test-tube', 'hospital', 'heartbeat', 'shield-check'
  ));

ALTER TABLE subcategories
  DROP CONSTRAINT subcategories_icon_key_chk,
  ADD CONSTRAINT subcategories_icon_key_chk CHECK (icon_key IN (
    'bowl-food', 'wine', 't-shirt', 'house', 'armchair', 'first-aid',
    'car', 'device-mobile', 'game-controller', 'graduation-cap', 'fork-knife',
    'sparkle', 'tag', 'airplane', 'bank', 'basket', 'bus', 'camera', 'coffee',
    'credit-card', 'dog', 'gift', 'heart', 'laptop', 'music-note', 'storefront',
    'carrot', 'fish', 'bread', 'egg', 'cookie', 'orange', 'pill', 'stethoscope',
    'tooth', 'eye', 'test-tube', 'hospital', 'heartbeat', 'shield-check'
  ));

UPDATE hfce_subcategory_defaults
SET icon_key = CASE slug
  WHEN 'food_groceries' THEN 'basket'
  WHEN 'food_fresh_produce' THEN 'carrot'
  WHEN 'food_meat_seafood' THEN 'fish'
  WHEN 'food_bakery' THEN 'bread'
  WHEN 'food_dairy_eggs' THEN 'egg'
  WHEN 'food_snacks_sweets' THEN 'cookie'
  WHEN 'food_non_alcoholic_drinks' THEN 'coffee'
  WHEN 'food_other' THEN 'orange'
  WHEN 'health_consultations' THEN 'stethoscope'
  WHEN 'health_medicines' THEN 'pill'
  WHEN 'health_dental' THEN 'tooth'
  WHEN 'health_eye_care' THEN 'eye'
  WHEN 'health_lab_tests' THEN 'test-tube'
  WHEN 'health_hospital' THEN 'hospital'
  WHEN 'health_therapy' THEN 'heartbeat'
  WHEN 'health_insurance' THEN 'shield-check'
  ELSE icon_key
END;

-- Upgrade generic seeded icons, preserving icons already customized by users.
UPDATE subcategories AS subcategory
SET icon_key = defaults.icon_key,
    updated_at = now(),
    version = subcategory.version + 1
FROM hfce_subcategory_defaults AS defaults
JOIN hfce_category_defaults AS category ON category.slug = defaults.category_slug
WHERE subcategory.user_id IS NOT NULL
  AND subcategory.deleted = false
  AND subcategory.slug = defaults.slug
  AND subcategory.icon_key IN (category.icon_key, 'tag')
  AND subcategory.icon_key IS DISTINCT FROM defaults.icon_key
  AND EXISTS (
    SELECT 1 FROM categories AS parent
    WHERE parent.id = subcategory.category_id
      AND parent.user_id = subcategory.user_id
      AND parent.slug = defaults.category_slug
      AND parent.deleted = false
  );
