import { calculateEmergencyFundBaseline, completedCalendarMonthRange } from "../emergencyFundBaseline";

describe("Emergency Fund baseline", () => {
  it("uses the six completed months before the creation month", () => {
    expect(completedCalendarMonthRange(new Date("2026-09-13T12:00:00Z"))).toEqual({ from: "2026-03-01", to: "2026-09-01" });
  });

  it("includes zero-spend months and rounds to whole centavos", () => {
    expect(calculateEmergencyFundBaseline(10)).toBe(2);
    expect(calculateEmergencyFundBaseline(9)).toBe(2);
  });
});
