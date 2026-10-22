import { SEASON_PRESETS, eventMonthLabel, LEGACY_SEASON_LABELS, type SeasonalPreferences } from "@odin/spending-insights/seasons";

export function seasonalPreferenceLabels(selections: string[], preferences: SeasonalPreferences): string[] {
  return selections.flatMap((key) => {
    if (key === "none") return ["No particular season"];
    const preset = SEASON_PRESETS.find((item) => item.key === key);
    if (preset) return [`${preset.label} · ${preset.window}`];
    const event = preferences.custom_seasonal_events.find((item) => item.id === key);
    if (event) return [`${event.name} · ${eventMonthLabel(event.months)}`];
    return LEGACY_SEASON_LABELS[key] ? [LEGACY_SEASON_LABELS[key]!] : [];
  });
}
