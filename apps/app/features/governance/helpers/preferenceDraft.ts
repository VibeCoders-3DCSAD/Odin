import { LEGACY_SEASON_LABELS, SEASONAL_KEYS, SEASON_PRESETS, eventMonthLabel, type SeasonalPreferences } from "@odin/spending-insights/seasons";

export type SeasonalPreferenceKey = typeof SEASONAL_KEYS[number];
export const PREFERENCE_GROUPS: { key: SeasonalPreferenceKey; label: string }[] = [
  { key: "high_expense_seasons", label: "Higher-Expense Seasons" },
  { key: "low_expense_seasons", label: "Lower-Expense Seasons" },
  { key: "saving_seasons", label: "Savings Seasons" },
];

export function preferenceChoices(preferences: SeasonalPreferences) {
  const selected = new Set(SEASONAL_KEYS.flatMap((key) => preferences[key]));
  return [
    ...SEASON_PRESETS.map((preset) => ({ key: preset.key, label: preset.label, months: preset.window })),
    ...Object.entries(LEGACY_SEASON_LABELS).filter(([key]) => selected.has(key)).map(([key, label]) => ({ key, label, months: "" })),
    ...preferences.custom_seasonal_events.map((event) => ({ key: event.id, label: event.name, months: eventMonthLabel(event.months) })),
    { key: "none", label: "No particular season", months: "" },
  ];
}

export function togglePreference(preferences: SeasonalPreferences, key: SeasonalPreferenceKey, choice: string): SeasonalPreferences {
  const selected = preferences[key];
  const choices = choice === "none" ? ["none"] : selected.includes(choice) ? selected.filter((value) => value !== choice) : [...selected.filter((value) => value !== "none"), choice];
  const next = { ...preferences, [key]: choices };
  if (key === "high_expense_seasons") next.low_expense_seasons = next.low_expense_seasons.filter((value) => value === "none" || !choices.includes(value));
  return next;
}

export function removeCustomEvent(preferences: SeasonalPreferences, id: string): SeasonalPreferences {
  return {
    ...preferences,
    custom_seasonal_events: preferences.custom_seasonal_events.filter((event) => event.id !== id),
    high_expense_seasons: preferences.high_expense_seasons.filter((key) => key !== id),
    low_expense_seasons: preferences.low_expense_seasons.filter((key) => key !== id),
    saving_seasons: preferences.saving_seasons.filter((key) => key !== id),
  };
}
