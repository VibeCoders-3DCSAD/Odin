// Candidate explanations supplied in the Philippine Monthly Spending Reference.
// These are applicability rules, never forecasting coefficients or household facts.
export const SPENDING_REFERENCE_PROVENANCE = {
  version: "2026-10-18",
  reference: "docs/philippine-monthly-spending-reference.md",
  categorySource: "https://psa.gov.ph/statistics/national-accounts/faqs",
  climateSource: "https://www.pagasa.dost.gov.ph/index.php/information/climate-philippines",
  lastReviewedAt: "2026-10-18",
  // The monthly budgeting possibilities are supplied reference material, not
  // verified causal findings or a verified calendar for any particular year.
  calendarLastVerifiedAt: null,
} as const;
export const HFCE_CATEGORY_SLUGS = [
  "food", "alcohol_tobacco", "clothing_footwear", "housing_water_utilities",
  "furnishings_household", "health", "transport", "communication",
  "recreation_culture", "education", "restaurants_hotels", "miscellaneous_goods_services",
] as const;
export type HfceCategorySlug = typeof HFCE_CATEGORY_SLUGS[number];

export type MonthlySpendingReference = {
  month: number;
  higher: readonly HfceCategorySlug[];
  lower: readonly HfceCategorySlug[];
  candidates: readonly string[];
};

// Category lists retrieve candidates only. They do not establish applicability.
export const MONTHLY_SPENDING_REFERENCE: readonly MonthlySpendingReference[] = [
  { month: 1, higher: ["food", "transport", "restaurants_hotels", "education", "miscellaneous_goods_services"], lower: ["food", "restaurants_hotels", "recreation_culture", "transport", "alcohol_tobacco"], candidates: ["new_year", "return_travel", "school_payments", "completed_celebrations"] },
  { month: 2, higher: ["food", "alcohol_tobacco", "transport", "restaurants_hotels", "recreation_culture", "miscellaneous_goods_services"], lower: ["recreation_culture", "restaurants_hotels", "transport"], candidates: ["valentines_day", "chinese_new_year", "completed_travel"] },
  { month: 3, higher: ["food", "housing_water_utilities", "health", "transport", "recreation_culture", "education", "restaurants_hotels"], lower: [], candidates: ["summer", "school_payments"] },
  { month: 4, higher: ["food", "housing_water_utilities", "transport", "recreation_culture", "education", "restaurants_hotels"], lower: ["transport", "education", "restaurants_hotels", "recreation_culture"], candidates: ["summer", "holy_week", "confirmed_break", "completed_travel"] },
  { month: 5, higher: ["clothing_footwear", "housing_water_utilities", "furnishings_household", "transport", "recreation_culture", "education", "restaurants_hotels", "miscellaneous_goods_services"], lower: ["transport", "restaurants_hotels", "recreation_culture", "housing_water_utilities"], candidates: ["summer", "school_preparation", "mothers_day", "completed_travel"] },
  { month: 6, higher: ["food", "clothing_footwear", "housing_water_utilities", "furnishings_household", "transport", "education"], lower: ["transport", "restaurants_hotels", "recreation_culture", "housing_water_utilities"], candidates: ["back_to_school", "rainy_season", "completed_travel"] },
  { month: 7, higher: ["housing_water_utilities", "furnishings_household", "health", "transport", "education"], lower: ["recreation_culture", "restaurants_hotels", "housing_water_utilities"], candidates: ["rainy_season", "school_payments", "canceled_outings"] },
  { month: 8, higher: ["food", "furnishings_household", "transport", "education", "restaurants_hotels"], lower: ["transport", "restaurants_hotels", "recreation_culture"], candidates: ["rainy_season", "back_to_school", "holiday_travel", "completed_travel"] },
  { month: 9, higher: ["food", "furnishings_household", "transport", "education", "recreation_culture", "miscellaneous_goods_services"], lower: ["recreation_culture", "restaurants_hotels", "transport"], candidates: ["rainy_season", "christmas_ber_months", "school_payments", "local_festival"] },
  { month: 10, higher: ["food", "furnishings_household", "transport", "education", "recreation_culture", "miscellaneous_goods_services"], lower: ["recreation_culture", "restaurants_hotels", "transport"], candidates: ["undas", "rainy_season", "christmas_ber_months", "halloween", "confirmed_break"] },
  { month: 11, higher: ["food", "clothing_footwear", "furnishings_household", "transport", "recreation_culture", "restaurants_hotels", "miscellaneous_goods_services"], lower: ["transport", "restaurants_hotels", "recreation_culture", "furnishings_household"], candidates: ["undas", "christmas_ber_months", "rainy_season", "completed_travel", "completed_repairs"] },
  { month: 12, higher: ["food", "alcohol_tobacco", "clothing_footwear", "housing_water_utilities", "transport", "recreation_culture", "restaurants_hotels", "miscellaneous_goods_services"], lower: ["transport", "education", "restaurants_hotels"], candidates: ["christmas_ber_months", "confirmed_break", "completed_travel"] },
];

export const SEASON_CATEGORY_RULES: Readonly<Record<string, { months: readonly number[]; categories: readonly HfceCategorySlug[] }>> = {
  new_year: { months: [1], categories: ["food", "alcohol_tobacco", "transport", "restaurants_hotels", "recreation_culture", "miscellaneous_goods_services"] },
  summer: { months: [3, 4, 5], categories: ["food", "housing_water_utilities", "health", "transport", "recreation_culture", "restaurants_hotels"] },
  back_to_school: { months: [6, 7, 8], categories: ["food", "clothing_footwear", "transport", "education"] },
  rainy_season: { months: [6, 7, 8, 9, 10, 11], categories: ["housing_water_utilities", "furnishings_household", "health", "transport", "recreation_culture", "restaurants_hotels"] },
  undas: { months: [10, 11], categories: ["food", "transport", "restaurants_hotels"] },
  christmas_ber_months: { months: [9, 10, 11, 12], categories: ["food", "alcohol_tobacco", "clothing_footwear", "housing_water_utilities", "transport", "recreation_culture", "restaurants_hotels", "miscellaneous_goods_services"] },
};

// Specific purchases, weather effects, tax due dates and completed activities are
// never established by selecting a season. The current selector only uses the
// user's reported pattern and actual scheduled-payment records. These candidates
// stay ineligible until a dedicated, dated source supplies the required facts.
export const ADDITIONAL_EVIDENCE_REQUIRED = {
  return_travel: "confirmed_trip_dates", school_payments: "recorded_school_payment",
  completed_celebrations: "completed_nonrecurring_event", valentines_day: "confirmed_celebration",
  chinese_new_year: "verified_year_calendar_and_participation", completed_travel: "completed_nonrecurring_trip",
  holy_week: "verified_year_calendar_and_participation", confirmed_break: "confirmed_work_or_school_break",
  school_preparation: "confirmed_school_calendar_and_purchase", mothers_day: "confirmed_celebration",
  canceled_outings: "confirmed_cancellation", holiday_travel: "confirmed_trip_dates",
  local_festival: "verified_local_calendar_and_participation", halloween: "confirmed_celebration",
  completed_repairs: "completed_nonrecurring_repair",
} as const;
