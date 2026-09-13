import { currentDebtTrendWindow, getPhilippineToday } from "../debtTrendRange";

describe("getPhilippineToday", () => {
  it("uses the Philippine calendar date instead of the UTC date", () => {
    const instant = new Date("2026-09-12T16:30:00.000Z");

    expect(getPhilippineToday(instant)).toBe("2026-09-13");
    expect(currentDebtTrendWindow("payoff", "2026-11-07", instant)).toEqual({ start: "2026-09-13", end: "2026-11-07" });
  });
});
