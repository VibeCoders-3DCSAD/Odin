-- Expand the HFCE category guidance used on the Categories page. Update the
-- defaults for new accounts and each existing user-owned HFCE category.
WITH descriptions (slug, description) AS (
  VALUES
    ('food', 'Rice, bread, meat, fish, seafood, milk, eggs, cheese, fruits, vegetables, sugar, snacks, coffee, tea, bottled water, soft drinks, juices, and other food purchased primarily for consumption at home.'),
    ('alcohol_tobacco', 'Beer, wine, spirits and other alcoholic drinks; cigarettes, cigars and other tobacco products.'),
    ('clothing_footwear', 'Clothes, uniforms, underwear, shoes, sandals, clothing materials; tailoring, clothing repair, shoe repair and related services.'),
    ('housing_water_utilities', 'Actual or imputed housing rentals, housing maintenance-related services, water supply, electricity, LPG, gas and other household fuels.'),
    ('furnishings_household', 'Furniture, appliances, household textiles, cookware, utensils, tools, cleaning products, household supplies, appliance and furniture repair, domestic and household services.'),
    ('health', 'Medicines, medical products, therapeutic equipment, doctor and dentist services, outpatient services and hospital services.'),
    ('transport', 'Purchase of cars, motorcycles, bicycles and other personal vehicles; fuel, lubricants, tires, vehicle parts, maintenance and repair, parking, tolls, and passenger transport such as buses, jeepneys, taxis, trains and air travel.'),
    ('communication', 'Postal services, phones and communication equipment, and telecommunications services such as mobile and internet-related communication services.'),
    ('recreation_culture', 'TVs and audiovisual equipment, computers and equipment classified for recreation, cameras, sporting equipment, toys, games, pets, recreational services, cinemas, entertainment, books, newspapers, stationery, package holidays and related cultural and recreational spending.'),
    ('education', 'Tuition and education services for preschool, primary, secondary, tertiary and other education.'),
    ('restaurants_hotels', 'Restaurant meals, cafes, fast food, catering and similar food services; hotels and other accommodation services.'),
    ('miscellaneous_goods_services', 'Personal care, barber and salon services, toiletries, jewelry and personal effects, social protection, insurance, financial services and other services not classified elsewhere.')
)
UPDATE hfce_category_defaults AS defaults
SET description = descriptions.description
FROM descriptions
WHERE defaults.slug = descriptions.slug;

WITH descriptions (slug, description) AS (
  VALUES
    ('food', 'Rice, bread, meat, fish, seafood, milk, eggs, cheese, fruits, vegetables, sugar, snacks, coffee, tea, bottled water, soft drinks, juices, and other food purchased primarily for consumption at home.'),
    ('alcohol_tobacco', 'Beer, wine, spirits and other alcoholic drinks; cigarettes, cigars and other tobacco products.'),
    ('clothing_footwear', 'Clothes, uniforms, underwear, shoes, sandals, clothing materials; tailoring, clothing repair, shoe repair and related services.'),
    ('housing_water_utilities', 'Actual or imputed housing rentals, housing maintenance-related services, water supply, electricity, LPG, gas and other household fuels.'),
    ('furnishings_household', 'Furniture, appliances, household textiles, cookware, utensils, tools, cleaning products, household supplies, appliance and furniture repair, domestic and household services.'),
    ('health', 'Medicines, medical products, therapeutic equipment, doctor and dentist services, outpatient services and hospital services.'),
    ('transport', 'Purchase of cars, motorcycles, bicycles and other personal vehicles; fuel, lubricants, tires, vehicle parts, maintenance and repair, parking, tolls, and passenger transport such as buses, jeepneys, taxis, trains and air travel.'),
    ('communication', 'Postal services, phones and communication equipment, and telecommunications services such as mobile and internet-related communication services.'),
    ('recreation_culture', 'TVs and audiovisual equipment, computers and equipment classified for recreation, cameras, sporting equipment, toys, games, pets, recreational services, cinemas, entertainment, books, newspapers, stationery, package holidays and related cultural and recreational spending.'),
    ('education', 'Tuition and education services for preschool, primary, secondary, tertiary and other education.'),
    ('restaurants_hotels', 'Restaurant meals, cafes, fast food, catering and similar food services; hotels and other accommodation services.'),
    ('miscellaneous_goods_services', 'Personal care, barber and salon services, toiletries, jewelry and personal effects, social protection, insurance, financial services and other services not classified elsewhere.')
)
UPDATE categories AS category
SET description = descriptions.description,
    updated_at = now(),
    version = category.version + 1
FROM descriptions
JOIN category_groups AS category_group ON category_group.slug = 'hfce_categories'
WHERE category.category_group_id = category_group.id
  AND category.slug = descriptions.slug
  AND category.deleted = false;
