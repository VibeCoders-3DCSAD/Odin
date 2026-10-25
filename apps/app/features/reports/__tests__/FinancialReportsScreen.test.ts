import { rangeFor } from "../reportRange";

describe("financial report ranges", () => {
  const now = new Date("2026-09-23T12:00:00Z");

  it("uses the first day of the current month for the monthly report", () => {
    expect(rangeFor("this_month", now)).toEqual({ startDate: "2026-09-01", endDate: "2026-09-23" });
  });

  it("uses the complete prior calendar month for the last-month report", () => {
    expect(rangeFor("last_month", now)).toEqual({ startDate: "2026-08-01", endDate: "2026-08-31" });
    expect(rangeFor("last_month", new Date("2026-01-05T12:00:00Z"))).toEqual({ startDate: "2025-12-01", endDate: "2025-12-31" });
  });

  it("uses calendar-aligned week and year ranges", () => {
    expect(rangeFor("this_week", now)).toEqual({ startDate: "2026-09-21", endDate: "2026-09-23" });
    expect(rangeFor("this_year", now)).toEqual({ startDate: "2026-01-01", endDate: "2026-09-23" });
  });
});
