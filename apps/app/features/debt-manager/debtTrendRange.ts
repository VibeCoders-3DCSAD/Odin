export type DebtTrendRange = "month" | "year" | "payoff" | "all";

export function currentDebtTrendWindow(range: DebtTrendRange, payoffDate?: string, today = new Date()): { start: string; end: string } {
  const philippineToday = getPhilippineToday(today);
  const [year, month] = philippineToday.split("-").map(Number) as [number, number, number];
  if (range === "payoff") return { start: philippineToday, end: payoffDate ?? philippineToday };
  const start = range === "year" ? `${year}-01-01` : `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = range === "year" ? 31 : new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = range === "year" ? `${year}-12-31` : `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  return { start, end };
}

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getPhilippineToday(today = new Date()): string {
  const philippineTime = new Date(today.getTime() + 8 * 60 * 60 * 1000);
  return `${philippineTime.getUTCFullYear()}-${String(philippineTime.getUTCMonth() + 1).padStart(2, "0")}-${String(philippineTime.getUTCDate()).padStart(2, "0")}`;
}

export function filterDebtTrendPoints<T extends { date: string }>(points: T[], range: DebtTrendRange, payoffDate?: string): T[] {
  if (range === "all") return payoffDate ? points.filter((point) => point.date <= payoffDate) : points;
  const { start, end } = currentDebtTrendWindow(range, payoffDate);
  return points.filter((point) => point.date >= start && point.date <= end);
}
