import type { ReportRange } from "../../local-db/repositories/financialReports";

export type ReportPeriod = "this_month" | "last_month" | "this_year" | "this_week";

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function rangeFor(period: ReportPeriod, now = new Date()): ReportRange {
  const endDate = localDate(now);
  if (period === "this_month") {
    return { startDate: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), endDate };
  }
  if (period === "last_month") {
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      startDate: localDate(previousMonth),
      endDate: localDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (period === "this_year") {
    return { startDate: `${now.getFullYear()}-01-01`, endDate };
  }
  const start = new Date(now);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return { startDate: localDate(start), endDate };
}
