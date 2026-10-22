export type CustomSeasonalEvent = { id: string; name: string; months: number[] };
export type SeasonalPreferences = {
  high_expense_seasons: string[];
  low_expense_seasons: string[];
  saving_seasons: string[];
  custom_seasonal_events: CustomSeasonalEvent[];
};
export const MONTH_NAMES: readonly string[];
export const SEASON_PRESETS: readonly { key: string; label: string; months: readonly number[]; window: string }[];
export const MAX_CUSTOM_EVENTS: number;
export const MAX_EVENT_NAME_LENGTH: number;
export const CUSTOM_EVENT_ID: RegExp;
export const SEASONAL_KEYS: readonly ("high_expense_seasons" | "low_expense_seasons" | "saving_seasons")[];
export const LEGACY_SEASON_LABELS: Readonly<Record<string, string>>;
export function seasonalPreferencesError(value: unknown): string | null;
export function normalizeEventName(name: string): string;
export function customEventsError(value: unknown): string | null;
export function normalizeCustomEvents(value: unknown): CustomSeasonalEvent[];
export function eventMonthLabel(months: readonly number[]): string;
