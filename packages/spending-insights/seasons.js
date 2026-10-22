const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SEASON_PRESETS = [
  { key: "new_year", label: "New Year", months: [1], window: "January" },
  { key: "summer", label: "Summer", months: [3, 4, 5], window: "March–May" },
  { key: "back_to_school", label: "Back-to-School", months: [6, 7, 8], window: "June–August" },
  { key: "rainy_season", label: "Rainy Season", months: [6, 7, 8, 9, 10, 11], window: "June–November" },
  { key: "undas", label: "Undas", months: [10, 11], window: "October–November" },
  { key: "christmas_ber_months", label: "Christmas and Ber Months", months: [9, 10, 11, 12], window: "September–December" },
];
const MAX_CUSTOM_EVENTS = 20;
const MAX_EVENT_NAME_LENGTH = 80;
const CUSTOM_EVENT_ID = /^custom_[a-zA-Z0-9-]{1,64}$/;
const SEASONAL_KEYS = ["high_expense_seasons", "low_expense_seasons", "saving_seasons"];
const LEGACY_SEASON_LABELS = {
  q1: "January–March", q2: "April–June", q3: "July–September", q4: "October–December",
  annual_payments: "Tax and Annual-Payment Season", family_celebrations: "Birthday and Family-Celebration Months", other: "Other",
};

function normalizeEventName(name) {
  return name.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function customEventsError(value) {
  if (!Array.isArray(value) || value.length > MAX_CUSTOM_EVENTS) return `Add at most ${MAX_CUSTOM_EVENTS} custom events.`;
  const ids = new Set();
  const names = new Set();
  for (const event of value) {
    if (!event || typeof event !== "object" || Array.isArray(event)
      || Object.keys(event).some((key) => !["id", "name", "months"].includes(key))) return "Each custom event needs an ID, name, and months.";
    if (typeof event.id !== "string" || !CUSTOM_EVENT_ID.test(event.id) || ids.has(event.id)) return "Custom event IDs must be valid and unique.";
    if (typeof event.name !== "string") return "Enter an event name.";
    const name = normalizeEventName(event.name);
    if (!name || name.length > MAX_EVENT_NAME_LENGTH || event.name.length > MAX_EVENT_NAME_LENGTH * 2 || /[<>\u0000-\u001f\u007f]/.test(event.name + name)) return `Event names must be plain text between 1 and ${MAX_EVENT_NAME_LENGTH} characters.`;
    const canonicalName = name.toLocaleLowerCase("en");
    if (names.has(canonicalName) || SEASON_PRESETS.some((preset) => preset.label.toLocaleLowerCase("en") === canonicalName)) return "An event with that name already exists.";
    if (!Array.isArray(event.months) || !event.months.length || event.months.length > 12
      || event.months.some((month) => !Number.isInteger(month) || month < 1 || month > 12)
      || new Set(event.months).size !== event.months.length) return "Select one or more distinct months from January to December.";
    ids.add(event.id);
    names.add(canonicalName);
  }
  return null;
}

function normalizeCustomEvents(value) {
  if (value === undefined || customEventsError(value)) return [];
  return value.map((event) => ({ id: event.id, name: normalizeEventName(event.name), months: [...event.months].sort((a, b) => a - b) }));
}

function eventMonthLabel(months) {
  return months.map((month) => MONTH_NAMES[month - 1]).join(", ");
}

function seasonalPreferencesError(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some((key) => ![...SEASONAL_KEYS, "custom_seasonal_events"].includes(key))) return "Only seasonal preferences can be changed here.";
  const eventError = customEventsError(value.custom_seasonal_events);
  if (eventError) return eventError;
  const allowed = new Set([...SEASON_PRESETS.map((preset) => preset.key), ...Object.keys(LEGACY_SEASON_LABELS), ...value.custom_seasonal_events.map((event) => event.id), "none"]);
  for (const key of SEASONAL_KEYS) {
    const choices = value[key];
    if (!Array.isArray(choices) || !choices.length || choices.length > 40) return "Select at least one answer for each seasonal preference, or choose no particular season.";
    if (choices.some((choice) => typeof choice !== "string" || !allowed.has(choice)) || new Set(choices).size !== choices.length) return "Select valid, distinct seasonal choices.";
    if (choices.includes("none") && choices.length > 1) return "No particular season cannot be combined with other choices.";
  }
  if (value.low_expense_seasons.some((choice) => choice !== "none" && value.high_expense_seasons.includes(choice))) return "A season cannot be selected for both higher and lower expenses.";
  return null;
}

module.exports = { MONTH_NAMES, SEASON_PRESETS, MAX_CUSTOM_EVENTS, MAX_EVENT_NAME_LENGTH, CUSTOM_EVENT_ID, SEASONAL_KEYS, LEGACY_SEASON_LABELS, normalizeEventName, customEventsError, normalizeCustomEvents, eventMonthLabel, seasonalPreferencesError };
