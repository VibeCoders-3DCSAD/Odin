export const TAXONOMY_ICON_KEYS = [
  "coat-hanger",
  "bowl-food", "wine", "t-shirt", "house", "armchair", "first-aid",
  "car", "device-mobile", "game-controller", "graduation-cap", "fork-knife", "sparkle", "tag",
  "airplane", "bank", "basket", "bus", "camera", "coffee", "credit-card", "dog", "gift", "heart", "laptop", "music-note", "storefront",
  "carrot", "fish", "bread", "egg", "cookie", "orange", "pill", "stethoscope", "tooth", "eye", "test-tube", "hospital", "heartbeat", "shield-check",
  "cake", "ice-cream", "hamburger", "pizza", "cooking-pot", "tea-bag",
  "beer-bottle", "beer-stein", "martini", "cigarette", "champagne", "brandy",
  "pants", "dress", "hoodie", "sock", "sneaker", "baseball-cap",
  "handbag", "watch", "lightning", "drop", "flame", "wifi-high",
  "key", "wrench", "plug", "bed", "washing-machine", "broom",
  "fan", "oven", "potted-plant", "lightbulb", "toolbox", "syringe",
  "thermometer", "wheelchair", "bandaids", "brain", "ambulance", "bicycle",
  "train", "gas-pump", "motorcycle", "taxi", "steering-wheel", "truck",
  "boat", "phone", "envelope", "globe", "sim-card", "chat-circle",
  "headphones", "film-slate", "ticket", "palette", "barbell", "book-open",
  "trophy", "tent", "pencil", "notebook", "calculator", "certificate",
  "backpack", "student", "scissors", "paw-print", "baby", "diamond",
  "scales", "identification-card", "wallet",
] as const;

export type TaxonomyIconKey = (typeof TAXONOMY_ICON_KEYS)[number];

// Each HFCE family has its own relevant choices; custom categories retain the full catalog.
const CATEGORY_ICON_OPTIONS: Record<string, readonly TaxonomyIconKey[]> = {
  food: ["bowl-food", "basket", "carrot", "fish", "bread", "egg", "cookie", "orange", "coffee", "cake", "ice-cream", "hamburger", "pizza", "cooking-pot", "tea-bag"],
  alcohol_tobacco: ["wine", "beer-bottle", "beer-stein", "martini", "champagne", "brandy", "cigarette", "storefront", "basket", "gift"],
  clothing_footwear: ["t-shirt", "pants", "dress", "hoodie", "sock", "sneaker", "baseball-cap", "handbag", "watch", "coat-hanger", "basket", "storefront"],
  housing_water_utilities: ["house", "bank", "shield-check", "key", "lightning", "drop", "flame", "wifi-high", "wrench", "plug", "lightbulb"],
  furnishings_household: ["armchair", "house", "fork-knife", "sparkle", "bed", "washing-machine", "broom", "fan", "oven", "potted-plant", "lightbulb", "toolbox", "cooking-pot"],
  health: ["first-aid", "stethoscope", "pill", "tooth", "eye", "test-tube", "hospital", "heartbeat", "shield-check", "syringe", "thermometer", "wheelchair", "bandaids", "brain", "ambulance"],
  transport: ["car", "bus", "airplane", "shield-check", "bicycle", "train", "gas-pump", "motorcycle", "taxi", "steering-wheel", "truck", "boat", "wrench"],
  communication: ["device-mobile", "laptop", "phone", "envelope", "globe", "wifi-high", "sim-card", "chat-circle", "headphones", "wrench"],
  recreation_culture: ["game-controller", "music-note", "camera", "dog", "airplane", "film-slate", "ticket", "palette", "barbell", "book-open", "trophy", "tent", "headphones"],
  education: ["graduation-cap", "laptop", "bus", "pencil", "book-open", "notebook", "calculator", "certificate", "backpack", "student", "globe"],
  restaurants_hotels: ["fork-knife", "coffee", "bowl-food", "house", "airplane", "bed", "cooking-pot", "hamburger", "pizza", "ice-cream", "tea-bag", "cake", "martini", "storefront"],
  miscellaneous_goods_services: ["sparkle", "bank", "credit-card", "dog", "gift", "heart", "shield-check", "tag", "scissors", "paw-print", "baby", "diamond", "scales", "identification-card", "wallet", "handbag"],
};

const SUBCATEGORY_DEFAULT_ICONS: Record<string, TaxonomyIconKey> = {
  food_groceries: "basket",
  food_fresh_produce: "carrot",
  food_meat_seafood: "fish",
  food_bakery: "bread",
  food_dairy_eggs: "egg",
  food_pantry_staples: "bowl-food",
  food_snacks_sweets: "cookie",
  food_non_alcoholic_drinks: "coffee",
  food_baby_food: "bowl-food",
  food_other: "orange",
  health_consultations: "stethoscope",
  health_medicines: "pill",
  health_dental: "tooth",
  health_eye_care: "eye",
  health_lab_tests: "test-tube",
  health_hospital: "hospital",
  health_therapy: "heartbeat",
  health_medical_devices: "first-aid",
  health_insurance: "shield-check",
  health_other: "first-aid",
};

export function subcategoryIconOptions(categorySlug: string): readonly TaxonomyIconKey[] {
  return CATEGORY_ICON_OPTIONS[categorySlug] ?? TAXONOMY_ICON_KEYS;
}

export function subcategoryIconKey(categorySlug: string, subcategorySlug?: string, savedIcon?: string): TaxonomyIconKey {
  const options = subcategoryIconOptions(categorySlug);
  if (savedIcon && options.includes(savedIcon as TaxonomyIconKey)) return savedIcon as TaxonomyIconKey;
  const defaultIcon = SUBCATEGORY_DEFAULT_ICONS[subcategorySlug ?? ""];
  if (defaultIcon && options.includes(defaultIcon)) return defaultIcon;
  return CATEGORY_ICON_OPTIONS[categorySlug]?.[0] ?? "tag";
}
