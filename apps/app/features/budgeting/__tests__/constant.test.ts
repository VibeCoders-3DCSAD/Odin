import { calculateBudgetSpentAmount, calculateProvisionalPercentage } from "../constant";

describe("provisional budget tracking", () => {
  test("calculates actual spending as a percentage of allocation", () => {
    expect(calculateProvisionalPercentage(2500, 10000)).toBe(25);
  });

  test("returns zero when no allocation exists", () => {
    expect(calculateProvisionalPercentage(2500, 0)).toBe(0);
  });
});

test("includes debt payments in total budget spending", () => {
  expect(calculateBudgetSpentAmount([100, 250], 400)).toBe(750);
});
