import { cashFlowComparisonFor, rangeFor } from "../reportRange";

describe("financial report ranges", () => {
  const now = new Date("2026-09-23T12:00:00Z");

  it("uses the first day of the current month for the monthly report", () => {
    expect(rangeFor("this_month", now)).toEqual({ startDate: "2026-09-01", endDate: "2026-09-23" });
  });

  it("uses calendar-aligned week and year ranges", () => {
    expect(rangeFor("this_week", now)).toEqual({ startDate: "2026-09-21", endDate: "2026-09-23" });
    expect(rangeFor("this_year", now)).toEqual({ startDate: "2026-01-01", endDate: "2026-09-23" });
  });

  it("uses the prior calendar period for week and month comparisons", () => {
    expect(cashFlowComparisonFor("this_month", now)).toEqual({
      range: { startDate: "2026-08-01", endDate: "2026-08-31" },
      label: "last month",
      averageByActiveMonth: false,
    });
    expect(cashFlowComparisonFor("this_week", now)).toEqual({
      range: { startDate: "2026-09-14", endDate: "2026-09-20" },
      label: "last week",
      averageByActiveMonth: false,
    });
  });

  it("compares yearly totals to the prior year's active-month average", () => {
    expect(cashFlowComparisonFor("this_year", new Date("2026-01-05T12:00:00Z"))).toEqual({
      range: { startDate: "2025-01-01", endDate: "2025-12-31" },
      label: "last year's average month",
      averageByActiveMonth: true,
    });
  });
});
