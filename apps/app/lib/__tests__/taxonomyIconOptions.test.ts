import { TAXONOMY_ICON_KEYS, subcategoryIconKey, subcategoryIconOptions } from "../taxonomyIconOptions";

describe("subcategory icon families", () => {
  it.each([
    "food", "alcohol_tobacco", "clothing_footwear", "housing_water_utilities",
    "furnishings_household", "health", "transport", "communication",
    "recreation_culture", "education", "restaurants_hotels", "miscellaneous_goods_services",
  ])("offers at least ten distinct supported choices for %s", (categorySlug) => {
    const options = subcategoryIconOptions(categorySlug);
    expect(options.length).toBeGreaterThanOrEqual(10);
    expect(new Set(options).size).toBe(options.length);
    expect(options.every((icon) => TAXONOMY_ICON_KEYS.includes(icon))).toBe(true);
  });

  it("offers different choices for Food and Health", () => {
    const food = subcategoryIconOptions("food");
    const health = subcategoryIconOptions("health");
    expect(food).toEqual(expect.arrayContaining(["carrot", "fish", "bread"]));
    expect(health).toEqual(expect.arrayContaining(["pill", "stethoscope", "tooth"]));
    expect(food.some((icon) => health.includes(icon))).toBe(false);
  });

  it("replaces unrelated saved icons with a relevant default", () => {
    expect(subcategoryIconKey("food", "food_bakery", "pill")).toBe("bread");
    expect(subcategoryIconKey("health", "health_dental", "coffee")).toBe("tooth");
    expect(subcategoryIconKey("health", "custom", "pill")).toBe("pill");
  });

  it("uses relevant defaults for new subcategories and supports custom categories", () => {
    expect(subcategoryIconKey("food")).toBe("bowl-food");
    expect(subcategoryIconKey("health")).toBe("first-aid");
    expect(subcategoryIconKey("custom")).toBe("tag");
    expect(subcategoryIconKey("custom", "custom-sub", "gift")).toBe("gift");
  });
});
