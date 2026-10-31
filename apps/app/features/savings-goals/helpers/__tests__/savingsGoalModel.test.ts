import { calculateEmergencyFundCoverageTarget, calculateSavingsGoalProgress } from "../savingsGoalModel";

describe("calculateSavingsGoalProgress", () => {
  const activity = (kind: "contribution" | "withdrawal", amountCentavos: number) => ({ id: `${kind}-${amountCentavos}`, savingsGoalId: "goal", transactionId: `transaction-${kind}-${amountCentavos}`, kind, amountCentavos, activityDate: "2026-01-01", notes: null, version: 1 });

  it("derives a centavo-safe balance, capped progress, and remaining amount", () => {
    expect(calculateSavingsGoalProgress(100, 1_000, [activity("contribution", 1_500)])).toMatchObject({ currentAmountCentavos: 1_600, remainingAmountCentavos: 0, progressPercent: 100, isAchieved: true });
  });

  it("reactivates a goal when a withdrawal drops it below target", () => {
    expect(calculateSavingsGoalProgress(1_000, 1_000, [activity("withdrawal", 1)])).toMatchObject({ currentAmountCentavos: 999, remainingAmountCentavos: 1, isAchieved: false });
  });

  it("calculates contribution shortfalls without treating withdrawals as contributions", () => {
    expect(calculateSavingsGoalProgress(0, 5_000, [activity("contribution", 500), activity("withdrawal", 200)], 1_000).contributionShortfallCentavos).toBe(500);
  });
});

describe("calculateEmergencyFundCoverageTarget", () => {
  it("returns an exact whole-centavo coverage target", () => {
    expect(calculateEmergencyFundCoverageTarget(12_345, 3)).toBe(37_035);
  });
});
