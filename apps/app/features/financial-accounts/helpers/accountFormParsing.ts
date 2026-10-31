export function parseSafeCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 15) return null;
  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  const cents = Math.round(parsed * 100);
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

export function parseDayOfMonth(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const day = parseInt(trimmed, 10);
  return day >= 1 && day <= 31 ? day : null;
}

export function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function toPickerDate(value: string | null): Date {
  const [year = 0, month = 0, day = 0] = (value ?? "").split("-").map(Number);
  return new Date(year, month - 1, day);
}
