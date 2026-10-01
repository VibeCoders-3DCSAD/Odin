import type { Migration } from "../client";

const migration: Migration = {
  version: 70,
  up: async (db) => {
    await db.execAsync(`
      UPDATE categories
      SET description = CASE slug
        WHEN 'food' THEN 'Rice, bread, meat, fish, seafood, milk, eggs, cheese, fruits, vegetables, sugar, snacks, coffee, tea, bottled water, soft drinks, juices, and other food purchased primarily for consumption at home.'
        WHEN 'alcohol_tobacco' THEN 'Beer, wine, spirits and other alcoholic drinks; cigarettes, cigars and other tobacco products.'
        WHEN 'clothing_footwear' THEN 'Clothes, uniforms, underwear, shoes, sandals, clothing materials; tailoring, clothing repair, shoe repair and related services.'
        WHEN 'housing_water_utilities' THEN 'Actual or imputed housing rentals, housing maintenance-related services, water supply, electricity, LPG, gas and other household fuels.'
        WHEN 'furnishings_household' THEN 'Furniture, appliances, household textiles, cookware, utensils, tools, cleaning products, household supplies, appliance and furniture repair, domestic and household services.'
        WHEN 'health' THEN 'Medicines, medical products, therapeutic equipment, doctor and dentist services, outpatient services and hospital services.'
        WHEN 'transport' THEN 'Purchase of cars, motorcycles, bicycles and other personal vehicles; fuel, lubricants, tires, vehicle parts, maintenance and repair, parking, tolls, and passenger transport such as buses, jeepneys, taxis, trains and air travel.'
        WHEN 'communication' THEN 'Postal services, phones and communication equipment, and telecommunications services such as mobile and internet-related communication services.'
        WHEN 'recreation_culture' THEN 'TVs and audiovisual equipment, computers and equipment classified for recreation, cameras, sporting equipment, toys, games, pets, recreational services, cinemas, entertainment, books, newspapers, stationery, package holidays and related cultural and recreational spending.'
        WHEN 'education' THEN 'Tuition and education services for preschool, primary, secondary, tertiary and other education.'
        WHEN 'restaurants_hotels' THEN 'Restaurant meals, cafes, fast food, catering and similar food services; hotels and other accommodation services.'
        WHEN 'miscellaneous_goods_services' THEN 'Personal care, barber and salon services, toiletries, jewelry and personal effects, social protection, insurance, financial services and other services not classified elsewhere.'
      END
      WHERE slug IN (
        'food', 'alcohol_tobacco', 'clothing_footwear',
        'housing_water_utilities', 'furnishings_household', 'health',
        'transport', 'communication', 'recreation_culture', 'education',
        'restaurants_hotels', 'miscellaneous_goods_services'
      )
        AND category_group_id IN (
          SELECT id FROM category_groups WHERE slug = 'hfce_categories'
        );
    `);
  },
};

export default migration;
