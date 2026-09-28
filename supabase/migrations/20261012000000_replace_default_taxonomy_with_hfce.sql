-- Replace the retired spending taxonomy with the HFCE categories served by
-- the quarterly forecasting endpoint. Retire records instead of deleting
-- them so historical transaction references remain valid.

INSERT INTO category_groups (slug, label, short_label, description, sort_order)
VALUES
  ('hfce_categories', 'HFCE Categories', 'HFCE', 'Philippine Statistics Authority household final consumption expenditure categories used by forecasting.', 100),
  ('user_defined_categories', 'User Defined Categories', 'User Defined', 'Categories created by the user or provided by future Odin features.', 200)
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label,
    short_label = EXCLUDED.short_label,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

UPDATE categories
SET category_group_id = (SELECT id FROM category_groups WHERE slug = 'user_defined_categories')
WHERE user_id IS NOT NULL
  AND category_group_id IN (
    SELECT id FROM category_groups
    WHERE slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
  );

UPDATE category_groups
SET is_active = false
WHERE slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation');

UPDATE categories
SET is_active = false
WHERE user_id IS NULL
  AND category_group_id IN (
    SELECT id FROM category_groups
    WHERE slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
  );

INSERT INTO categories (category_group_id, user_id, slug, label, short_label, description, is_system, is_filipino_context, sort_order)
VALUES
  ((SELECT id FROM category_groups WHERE slug = 'hfce_categories'), NULL, 'food', 'Food and Non-alcoholic Beverages', 'Food', 'Food and non-alcoholic beverages.', true, false, 100),
  ((SELECT id FROM category_groups WHERE slug = 'hfce_categories'), NULL, 'alcohol_tobacco', 'Alcoholic Beverages and Tobacco', 'Alcohol/Tobacco', 'Alcoholic beverages and tobacco.', true, false, 110),
  ((SELECT id FROM category_groups WHERE slug = 'hfce_categories'), NULL, 'clothing_footwear', 'Clothing and Footwear', 'Clothing', 'Clothing and footwear.', true, false, 120),
  ((SELECT id FROM category_groups WHERE slug = 'hfce_categories'), NULL, 'housing_water_utilities', 'Housing, Water, Electricity, Gas and Other Fuels', 'Housing/Utilities', 'Housing, water, electricity, gas, and other fuels.', true, false, 130),
  ((SELECT id FROM category_groups WHERE slug = 'hfce_categories'), NULL, 'furnishings_household', 'Furnishings, Household Equipment and Routine Maintenance', 'Household', 'Furnishings, household equipment, and routine household maintenance.', true, false, 140),
  ((SELECT id FROM category_groups WHERE slug = 'hfce_categories'), NULL, 'health', 'Health', 'Health', 'Health goods and services.', true, false, 150),
  ((SELECT id FROM category_groups WHERE slug = 'hfce_categories'), NULL, 'transport', 'Transport', 'Transport', 'Transport goods and services.', true, false, 160),
  ((SELECT id FROM category_groups WHERE slug = 'hfce_categories'), NULL, 'communication', 'Communication', 'Communication', 'Communication goods and services.', true, false, 170),
  ((SELECT id FROM category_groups WHERE slug = 'hfce_categories'), NULL, 'recreation_culture', 'Recreation and Culture', 'Recreation', 'Recreation and cultural goods and services.', true, false, 180),
  ((SELECT id FROM category_groups WHERE slug = 'hfce_categories'), NULL, 'education', 'Education', 'Education', 'Education goods and services.', true, false, 190),
  ((SELECT id FROM category_groups WHERE slug = 'hfce_categories'), NULL, 'restaurants_hotels', 'Restaurants and Hotels', 'Restaurants/Hotels', 'Restaurant and hotel services.', true, false, 200),
  ((SELECT id FROM category_groups WHERE slug = 'hfce_categories'), NULL, 'miscellaneous_goods_services', 'Miscellaneous Goods and Services', 'Miscellaneous', 'Miscellaneous goods and services.', true, false, 210)
ON CONFLICT (slug) WHERE user_id IS NULL DO UPDATE
SET category_group_id = EXCLUDED.category_group_id,
    label = EXCLUDED.label,
    short_label = EXCLUDED.short_label,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

UPDATE subcategories
SET is_active = false
WHERE category_id IN (
  SELECT id FROM categories
  WHERE user_id IS NULL
    AND category_group_id = (SELECT id FROM category_groups WHERE slug = 'hfce_categories')
)
  AND slug IN ('food', 'alcohol_tobacco', 'clothing_footwear', 'housing_water_utilities', 'furnishings_household', 'health', 'transport', 'communication', 'recreation_culture', 'education', 'restaurants_hotels', 'miscellaneous_goods_services');

WITH hfce_subcategories (category_slug, slug, label, short_label, sort_order) AS (
  VALUES
    ('food', 'food_groceries', 'Groceries', 'Groceries', 100),
    ('food', 'food_fresh_produce', 'Fresh Produce', 'Produce', 110),
    ('food', 'food_meat_seafood', 'Meat and Seafood', 'Meat/Seafood', 120),
    ('food', 'food_bakery', 'Bread and Bakery', 'Bakery', 130),
    ('food', 'food_dairy_eggs', 'Dairy and Eggs', 'Dairy/Eggs', 140),
    ('food', 'food_pantry_staples', 'Pantry Staples', 'Pantry', 150),
    ('food', 'food_snacks_sweets', 'Snacks and Sweets', 'Snacks', 160),
    ('food', 'food_non_alcoholic_drinks', 'Non-alcoholic Drinks', 'Drinks', 170),
    ('food', 'food_baby_food', 'Baby Food', 'Baby Food', 180),
    ('food', 'food_other', 'Other Food', 'Other Food', 190),
    ('alcohol_tobacco', 'alcohol_beer', 'Beer', 'Beer', 100),
    ('alcohol_tobacco', 'alcohol_wine', 'Wine', 'Wine', 110),
    ('alcohol_tobacco', 'alcohol_spirits', 'Spirits', 'Spirits', 120),
    ('alcohol_tobacco', 'alcohol_ready_to_drink', 'Ready-to-drink Alcohol', 'RTD', 130),
    ('alcohol_tobacco', 'tobacco_cigarettes', 'Cigarettes', 'Cigarettes', 140),
    ('alcohol_tobacco', 'tobacco_vape', 'Vape Products', 'Vape', 150),
    ('alcohol_tobacco', 'tobacco_cigars', 'Cigars', 'Cigars', 160),
    ('alcohol_tobacco', 'tobacco_rolling', 'Rolling Tobacco', 'Rolling', 170),
    ('alcohol_tobacco', 'tobacco_accessories', 'Tobacco Accessories', 'Accessories', 180),
    ('alcohol_tobacco', 'alcohol_tobacco_other', 'Other Alcohol and Tobacco', 'Other', 190),
    ('clothing_footwear', 'clothing_womens', 'Women''s Clothing', 'Women''s', 100),
    ('clothing_footwear', 'clothing_mens', 'Men''s Clothing', 'Men''s', 110),
    ('clothing_footwear', 'clothing_childrens', 'Children''s Clothing', 'Children''s', 120),
    ('clothing_footwear', 'footwear', 'Footwear', 'Footwear', 130),
    ('clothing_footwear', 'clothing_accessories', 'Clothing Accessories', 'Accessories', 140),
    ('clothing_footwear', 'clothing_underwear_sleepwear', 'Underwear and Sleepwear', 'Underwear', 150),
    ('clothing_footwear', 'clothing_sportswear', 'Sportswear', 'Sportswear', 160),
    ('clothing_footwear', 'clothing_uniforms', 'Uniforms', 'Uniforms', 170),
    ('clothing_footwear', 'clothing_repairs', 'Clothing Repairs', 'Repairs', 180),
    ('clothing_footwear', 'clothing_other', 'Other Clothing', 'Other', 190),
    ('housing_water_utilities', 'housing_rent', 'Rent', 'Rent', 100),
    ('housing_water_utilities', 'housing_mortgage', 'Mortgage', 'Mortgage', 110),
    ('housing_water_utilities', 'housing_electricity', 'Electricity Bill', 'Electricity', 120),
    ('housing_water_utilities', 'housing_water', 'Water Bill', 'Water', 130),
    ('housing_water_utilities', 'housing_cooking_gas', 'Cooking Gas', 'Cooking Gas', 140),
    ('housing_water_utilities', 'housing_internet', 'Home Internet', 'Internet', 150),
    ('housing_water_utilities', 'housing_home_repairs', 'Home Repairs', 'Repairs', 160),
    ('housing_water_utilities', 'housing_condo_dues', 'Condominium or Association Dues', 'Association Dues', 170),
    ('housing_water_utilities', 'housing_security_services', 'Housing Security', 'Security', 180),
    ('housing_water_utilities', 'housing_other', 'Other Housing and Utilities', 'Other', 190),
    ('furnishings_household', 'household_furniture', 'Furniture', 'Furniture', 100),
    ('furnishings_household', 'household_appliances', 'Appliances', 'Appliances', 110),
    ('furnishings_household', 'household_kitchenware', 'Kitchenware', 'Kitchenware', 120),
    ('furnishings_household', 'household_cleaning_supplies', 'Cleaning Supplies', 'Cleaning', 130),
    ('furnishings_household', 'household_laundry', 'Laundry', 'Laundry', 140),
    ('furnishings_household', 'household_bedding', 'Bedding and Linens', 'Bedding', 150),
    ('furnishings_household', 'household_garden', 'Garden and Outdoor', 'Garden', 160),
    ('furnishings_household', 'household_pest_control', 'Pest Control', 'Pest Control', 170),
    ('furnishings_household', 'household_domestic_help', 'Domestic Help', 'Domestic Help', 180),
    ('furnishings_household', 'household_other', 'Other Household Items', 'Other', 190),
    ('health', 'health_consultations', 'Medical Consultations', 'Consultations', 100),
    ('health', 'health_medicines', 'Medicines', 'Medicines', 110),
    ('health', 'health_dental', 'Dental Care', 'Dental', 120),
    ('health', 'health_eye_care', 'Eye Care', 'Eye Care', 130),
    ('health', 'health_lab_tests', 'Laboratory Tests', 'Lab Tests', 140),
    ('health', 'health_hospital', 'Hospital Services', 'Hospital', 150),
    ('health', 'health_therapy', 'Therapy and Rehabilitation', 'Therapy', 160),
    ('health', 'health_medical_devices', 'Medical Devices', 'Devices', 170),
    ('health', 'health_insurance', 'Health Insurance', 'Insurance', 180),
    ('health', 'health_other', 'Other Health Costs', 'Other', 190),
    ('transport', 'transport_public', 'Public Transport', 'Public Transport', 100),
    ('transport', 'transport_ride_hailing', 'Ride-hailing', 'Ride-hailing', 110),
    ('transport', 'transport_fuel', 'Fuel', 'Fuel', 120),
    ('transport', 'transport_parking', 'Parking and Tolls', 'Parking/Tolls', 130),
    ('transport', 'transport_vehicle_maintenance', 'Vehicle Maintenance', 'Maintenance', 140),
    ('transport', 'transport_vehicle_insurance', 'Vehicle Insurance', 'Insurance', 150),
    ('transport', 'transport_vehicle_registration', 'Vehicle Registration', 'Registration', 160),
    ('transport', 'transport_bicycle', 'Bicycle and Micromobility', 'Micromobility', 170),
    ('transport', 'transport_intercity', 'Intercity Travel', 'Intercity', 180),
    ('transport', 'transport_other', 'Other Transport', 'Other', 190),
    ('communication', 'communication_mobile_postpaid', 'Mobile Postpaid', 'Postpaid', 100),
    ('communication', 'communication_mobile_prepaid', 'Mobile Prepaid', 'Prepaid', 110),
    ('communication', 'communication_home_phone', 'Home Phone', 'Home Phone', 120),
    ('communication', 'communication_device', 'Communication Devices', 'Devices', 130),
    ('communication', 'communication_device_repairs', 'Device Repairs', 'Repairs', 140),
    ('communication', 'communication_postage', 'Postage and Courier', 'Courier', 150),
    ('communication', 'communication_online_services', 'Online Communication Services', 'Online Services', 160),
    ('communication', 'communication_international_calls', 'International Calls', 'International', 170),
    ('communication', 'communication_sim_cards', 'SIM Cards and Load', 'SIM/Load', 180),
    ('communication', 'communication_other', 'Other Communication', 'Other', 190),
    ('recreation_culture', 'recreation_streaming', 'Streaming Services', 'Streaming', 100),
    ('recreation_culture', 'recreation_cinema', 'Cinema and Theatre', 'Cinema', 110),
    ('recreation_culture', 'recreation_events', 'Events and Concerts', 'Events', 120),
    ('recreation_culture', 'recreation_sports', 'Sports and Fitness', 'Sports', 130),
    ('recreation_culture', 'recreation_hobbies', 'Hobbies and Crafts', 'Hobbies', 140),
    ('recreation_culture', 'recreation_books', 'Books and Media', 'Books/Media', 150),
    ('recreation_culture', 'recreation_games', 'Games', 'Games', 160),
    ('recreation_culture', 'recreation_museums', 'Museums and Attractions', 'Attractions', 170),
    ('recreation_culture', 'recreation_photography', 'Photography', 'Photography', 180),
    ('recreation_culture', 'recreation_other', 'Other Recreation', 'Other', 190),
    ('education', 'education_tuition', 'Tuition Fees', 'Tuition', 100),
    ('education', 'education_school_fees', 'School Fees', 'School Fees', 110),
    ('education', 'education_supplies', 'School Supplies', 'Supplies', 120),
    ('education', 'education_books', 'Textbooks', 'Textbooks', 130),
    ('education', 'education_tutoring', 'Tutoring', 'Tutoring', 140),
    ('education', 'education_online_courses', 'Online Courses', 'Online Courses', 150),
    ('education', 'education_training', 'Professional Training', 'Training', 160),
    ('education', 'education_exams', 'Examination Fees', 'Exams', 170),
    ('education', 'education_transport', 'Education Transport', 'Education Transport', 180),
    ('education', 'education_other', 'Other Education', 'Other', 190),
    ('restaurants_hotels', 'restaurants_fast_food', 'Fast Food', 'Fast Food', 100),
    ('restaurants_hotels', 'restaurants_casual_dining', 'Casual Dining', 'Casual Dining', 110),
    ('restaurants_hotels', 'restaurants_fine_dining', 'Fine Dining', 'Fine Dining', 120),
    ('restaurants_hotels', 'restaurants_cafes', 'Cafes', 'Cafes', 130),
    ('restaurants_hotels', 'restaurants_delivery', 'Food Delivery', 'Delivery', 140),
    ('restaurants_hotels', 'restaurants_street_food', 'Street Food', 'Street Food', 150),
    ('restaurants_hotels', 'hotels_accommodation', 'Hotel Accommodation', 'Hotels', 160),
    ('restaurants_hotels', 'hotels_resorts', 'Resorts', 'Resorts', 170),
    ('restaurants_hotels', 'restaurants_catering', 'Catering', 'Catering', 180),
    ('restaurants_hotels', 'restaurants_hotels_other', 'Other Restaurants and Hotels', 'Other', 190),
    ('miscellaneous_goods_services', 'misc_personal_care', 'Personal Care and Grooming', 'Personal Care', 100),
    ('miscellaneous_goods_services', 'misc_insurance', 'Other Insurance', 'Insurance', 110),
    ('miscellaneous_goods_services', 'misc_financial_services', 'Financial Services', 'Financial', 120),
    ('miscellaneous_goods_services', 'misc_legal_services', 'Legal Services', 'Legal', 130),
    ('miscellaneous_goods_services', 'misc_social_protection', 'Social Protection', 'Social Protection', 140),
    ('miscellaneous_goods_services', 'misc_childcare', 'Childcare', 'Childcare', 150),
    ('miscellaneous_goods_services', 'misc_pet_care', 'Pet Care', 'Pet Care', 160),
    ('miscellaneous_goods_services', 'misc_jewelry', 'Jewelry and Watches', 'Jewelry', 170),
    ('miscellaneous_goods_services', 'misc_personal_documents', 'Personal Documents', 'Documents', 180),
    ('miscellaneous_goods_services', 'misc_other', 'Other Goods and Services', 'Other', 190)
)
INSERT INTO subcategories (category_id, user_id, slug, kind, label, short_label, description, is_system, is_filipino_context, is_protected_default, sort_order)
SELECT category.id, NULL, item.slug, 'expense', item.label, item.short_label, item.label || '.', true, false, false, item.sort_order
FROM hfce_subcategories AS item
JOIN categories AS category ON category.slug = item.category_slug AND category.user_id IS NULL
ON CONFLICT (slug) WHERE user_id IS NULL DO UPDATE
SET category_id = EXCLUDED.category_id,
    label = EXCLUDED.label,
    short_label = EXCLUDED.short_label,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = true;
