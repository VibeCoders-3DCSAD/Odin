import { calculateBudgetAllocatedAmount } from "../constant";

describe("calculateBudgetAllocatedAmount", () => {
  it("includes category, debt, and savings envelopes", () => {
    expect(calculateBudgetAllocatedAmount(6_000, 2_500, 1_500)).toBe(10_000);
  });
});
