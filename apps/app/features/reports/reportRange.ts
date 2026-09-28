import type { ReportRange } from "../../local-db/repositories/financialReports";

export type ReportPeriod = "this_month" | "this_year" | "this_week";
export type CashFlowComparison = { range: ReportRange; label: string; averageByActiveMonth: boolean };

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function rangeFor(period: ReportPeriod, now = new Date()): ReportRange {
  const endDate = localDate(now);
  if (period === "this_month") {
    return { startDate: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), endDate };
  }
  if (period === "this_year") {
    return { startDate: `${now.getFullYear()}-01-01`, endDate };
  }
  const start = new Date(now);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return { startDate: localDate(start), endDate };
}

export function cashFlowComparisonFor(period: ReportPeriod, now = new Date()): CashFlowComparison {
  if (period === "this_year") {
    const year = now.getFullYear() - 1;
    return {
      range: { startDate: `${year}-01-01`, endDate: `${year}-12-31` },
      label: "last year's average month",
      averageByActiveMonth: true,
    };
  }

  if (period === "this_month") {
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      range: {
        startDate: localDate(previousMonth),
        endDate: localDate(new Date(now.getFullYear(), now.getMonth(), 0)),
      },
      label: "last month",
      averageByActiveMonth: false,
    };
  }

  const currentWeek = rangeFor("this_week", now);
  const previousWeekEnd = new Date(`${currentWeek.startDate}T00:00:00`);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
  const previousWeekStart = new Date(previousWeekEnd);
  previousWeekStart.setDate(previousWeekStart.getDate() - 6);
  return {
    range: { startDate: localDate(previousWeekStart), endDate: localDate(previousWeekEnd) },
    label: "last week",
    averageByActiveMonth: false,
  };
}
