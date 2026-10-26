import { historyWindow, isFullYear, seasonalMonthSpend } from "@odin/spending-insights/seasonalMonth.js";

const window = historyWindow(["2025-09", "2025-10", "2026-03", "2026-10"], "2026-10");
const spend = (amounts: Record<string, number>) => new Map(Object.entries(amounts));
const everyMonth = (amount: number) => spend(Object.fromEntries(window.map((month) => [month, amount])));

describe("seasonal month spend, as odin-ml forecasts a full year", () => {
  it("covers the completed months of the last year from the first expense", () => {
    expect(window).toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(isFullYear(window)).toBe(true);
    expect(isFullYear(historyWindow(["2026-03"], "2026-10"))).toBe(false);
  });

  it("starts from last month when it was a typical month", () => {
    const monthly = spend(Object.fromEntries(window.map((month, index) => [month, index % 2 ? 11_000 : 9_000])));
    monthly.set("2026-09", 10_500);
    expect(seasonalMonthSpend({ window, monthly, recurring: 0, targetMonth: "2026-10" })).toBe(10_500);
  });

  it("brings back last year's spike in the same month above the typical month", () => {
    const monthly = spend({ ...Object.fromEntries(everyMonth(10_000)), "2025-12": 50_000 });
    expect(seasonalMonthSpend({ window, monthly, recurring: 0, targetMonth: "2026-12" })).toBe(50_000);
    expect(seasonalMonthSpend({ window, monthly, recurring: 0, targetMonth: "2026-11" })).toBe(10_000);
  });

  it("expects a one-month expense only in the month it happened last year", () => {
    const monthly = spend({ "2025-10": 40_000 });
    expect(seasonalMonthSpend({ window, monthly, recurring: 0, targetMonth: "2026-10" })).toBe(40_000);
    expect(seasonalMonthSpend({ window, monthly, recurring: 0, targetMonth: "2026-11" })).toBe(0);
  });

  it("follows spending that turns on and off with the calendar", () => {
    const monthly = spend({ "2026-06": 30_000, "2026-07": 32_000 });
    expect(seasonalMonthSpend({ window, monthly, recurring: 0, targetMonth: "2026-10" })).toBe(0);
    expect(seasonalMonthSpend({ window, monthly, recurring: 0, targetMonth: "2027-06" })).toBe(31_000);
  });

  it("keeps a new expense going from its latest month", () => {
    expect(seasonalMonthSpend({ window, monthly: spend({ "2026-07": 8_000, "2026-08": 9_000, "2026-09": 9_500 }), recurring: 0, targetMonth: "2026-10" })).toBe(9_500);
  });

  it("adds what recurring payments expect on top of the usual month", () => {
    expect(seasonalMonthSpend({ window, monthly: everyMonth(10_000), recurring: 25_000, targetMonth: "2026-11" })).toBe(35_000);
    expect(seasonalMonthSpend({ window, monthly: everyMonth(10_000), recurring: 0, targetMonth: "2026-10" })).toBe(10_000);
  });
});
