export type MoneyFormatOptions = {
  // Text before the digits, e.g. "PHP " or "₱".
  prefix?: string;
  // Minimum and maximum fraction digits.
  fractionDigits?: number;
  // true: "-₱1.00" (sign before the prefix); false: "PHP -1.00" (sign inside the number).
  signBeforePrefix?: boolean;
  // Strings longer than this are cut to (truncateAfter - 3) characters plus "...".
  truncateAfter?: number;
};

// The one en-PH money formatter. Callers pick options that reproduce the text their screen shows.
export function formatMoney(centavos: number, options: MoneyFormatOptions = {}): string {
  const { prefix = "PHP ", fractionDigits = 2, signBeforePrefix = false, truncateAfter } = options;
  const localeOptions = { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits };
  const formatted = signBeforePrefix
    ? `${centavos < 0 ? "-" : ""}${prefix}${(Math.abs(centavos) / 100).toLocaleString("en-PH", localeOptions)}`
    : `${prefix}${(centavos / 100).toLocaleString("en-PH", localeOptions)}`;
  return truncateAfter !== undefined && formatted.length > truncateAfter ? formatted.slice(0, truncateAfter - 3) + "..." : formatted;
}

// "PHP 1,234.50"; negatives read "PHP -1,234.50".
export function formatPhp(centavos: number): string {
  return formatMoney(centavos);
}

// formatPhp, or `fallback` when the amount is unknown.
export function formatPhpOr(centavos: number | null | undefined, fallback: string): string {
  return centavos == null ? fallback : formatPhp(centavos);
}

// Amount parsers. The forms disagree on what they accept, so each rule keeps its own name.

// Lenient: strips commas and accepts any finite number (negatives, exponents, more than two decimals,
// rounded to the nearest centavo). Blank input is null.
export function parseLenientCentavos(value: string): number | null {
  const amount = Number(value.replace(/,/g, ""));
  return value.trim() && Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

// Plain digits with at most two decimals and no commas, e.g. "1500" or "1500.5".
export function parsePlainCentavos(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  return Math.round(Number(value) * 100);
}

// Digits with optional commas and at most two decimals, converted without floating-point rounding and
// rejected past Number.MAX_SAFE_INTEGER centavos.
export function parseExactCentavos(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(amount) ? amount : null;
}
