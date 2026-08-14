import { calculateProvisionalPercentage } from "../constant";

describe("provisional budget tracking", () => {
  test("calculates actual spending as a percentage of allocation", () => {
    expect(calculateProvisionalPercentage(2500, 10000)).toBe(25);
  });

  test("returns zero when no allocation exists", () => {
    expect(calculateProvisionalPercentage(2500, 0)).toBe(0);
  });
});
