export type DebtTrendRange = "month" | "year" | "payoff" | "all";

export function currentDebtTrendWindow(range: DebtTrendRange, payoffDate?: string, today = new Date()): { start: string; end: string } {
  const year = today.getFullYear();
  const month = today.getMonth();
  if (range === "payoff") return { start: toIso(today), end: payoffDate ?? toIso(today) };
  const start = range === "year" ? new Date(year, 0, 1) : new Date(year, month, 1);
  const end = range === "year" ? new Date(year, 11, 31) : new Date(year, month + 1, 0);
  return { start: toIso(start), end: toIso(end) };
}

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function filterDebtTrendPoints<T extends { date: string }>(points: T[], range: DebtTrendRange, payoffDate?: string): T[] {
  if (range === "all") return payoffDate ? points.filter((point) => point.date <= payoffDate) : points;
  const { start, end } = currentDebtTrendWindow(range, payoffDate);
  return points.filter((point) => point.date >= start && point.date <= end);
}
