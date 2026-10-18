-- Keep the server-side validation aligned with the expanded icon picker.
ALTER TABLE categories
  DROP CONSTRAINT categories_icon_key_chk,
  ADD CONSTRAINT categories_icon_key_chk CHECK (icon_key IN (
    'bowl-food', 'wine', 't-shirt', 'house', 'armchair', 'first-aid',
    'car', 'device-mobile', 'game-controller', 'graduation-cap', 'fork-knife',
    'sparkle', 'tag', 'airplane', 'bank', 'basket', 'bus', 'camera', 'coffee',
    'credit-card', 'dog', 'gift', 'heart', 'laptop', 'music-note', 'storefront'
  ));

ALTER TABLE subcategories
  DROP CONSTRAINT subcategories_icon_key_chk,
  ADD CONSTRAINT subcategories_icon_key_chk CHECK (icon_key IN (
    'bowl-food', 'wine', 't-shirt', 'house', 'armchair', 'first-aid',
    'car', 'device-mobile', 'game-controller', 'graduation-cap', 'fork-knife',
    'sparkle', 'tag', 'airplane', 'bank', 'basket', 'bus', 'camera', 'coffee',
    'credit-card', 'dog', 'gift', 'heart', 'laptop', 'music-note', 'storefront'
  ));
