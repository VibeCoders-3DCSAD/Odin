const PESO_DIGITS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

// The amount without the symbol, e.g. "1,234.50", for screens that style the "₱" separately.
export function formatPesoAmount(centavos: number): string {
  return (Math.abs(centavos) / 100).toLocaleString("en-PH", PESO_DIGITS);
}

// Every amount the app shows: "₱1,234.50", negatives "-₱1,234.50". Strings longer than
// `truncateAfter` are cut to (truncateAfter - 3) characters plus "...".
export function formatPeso(centavos: number, options: { truncateAfter?: number } = {}): string {
  const formatted = `${centavos < 0 ? "-" : ""}₱${formatPesoAmount(centavos)}`;
  const { truncateAfter } = options;
  return truncateAfter !== undefined && formatted.length > truncateAfter ? formatted.slice(0, truncateAfter - 3) + "..." : formatted;
}

// formatPeso, or `fallback` when the amount is unknown.
export function formatPesoOr(centavos: number | null | undefined, fallback: string): string {
  return centavos == null ? fallback : formatPeso(centavos);
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
