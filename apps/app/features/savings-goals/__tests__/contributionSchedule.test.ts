import { getMinimumContributionPerOccurrence, getRequiredSavingsContributions, validateContributionSchedule, type ScheduledSavingsGoal } from "../contributionSchedule";

function goal(overrides: Partial<ScheduledSavingsGoal> = {}): ScheduledSavingsGoal {
  return {
    id: "goal-1",
    status: "active",
    remainingAmountCentavos: 1_001,
    isAchieved: false,
    targetDate: "2026-04-30",
    plannedContributionAmountCentavos: 500,
    contributionFrequency: "weekly",
    contributionIntervalCount: 1,
    contributionDayOfMonth: null,
    contributionSecondDayOfMonth: null,
    contributionDayOfWeek: null,
    customIntervalDays: null,
    nextContributionDate: "2026-04-02",
    ...overrides,
  };
}

describe("Savings Goal contribution schedules", () => {
  it("requires a cadence and anchor date", () => {
    expect(validateContributionSchedule({ ...goal(), contributionFrequency: null })).toContain("frequency");
    expect(validateContributionSchedule({ ...goal(), nextContributionDate: null })).toContain("next contribution date");
    expect(validateContributionSchedule({ ...goal(), contributionFrequency: "custom", customIntervalDays: null })).toContain("custom");
  });

  it("uses centavo ceiling rounding across remaining occurrences", () => {
    expect(getMinimumContributionPerOccurrence(goal(), "2026-04-01")).toBe(201);
  });

  it("totals only scheduled active goals and subtracts recorded contributions in the period", () => {
    const result = getRequiredSavingsContributions("2026-04-01", "2026-04-15", [
      goal(),
      goal({ id: "achieved", isAchieved: true }),
    ], new Map([["goal-1", [{ id: "activity-1", savingsGoalId: "goal-1", transactionId: "transaction-1", kind: "contribution", amountCentavos: 100, activityDate: "2026-04-02", notes: null, version: 1 }]]]));

    expect(result).toEqual({
      totalRequiredCentavos: 302,
      contributions: [expect.objectContaining({ goalId: "goal-1", scheduledDates: ["2026-04-02", "2026-04-09"], minimumPerOccurrenceCentavos: 201, configuredMinimumCentavos: 402, recordedContributionCentavos: 100, remainingRequiredCentavos: 302 })],
    });
  });

  it("uses the two configured monthly days for semi-monthly schedules", () => {
    expect(getMinimumContributionPerOccurrence(goal({ contributionFrequency: "semi_monthly", contributionDayOfMonth: 1, contributionSecondDayOfMonth: 15, nextContributionDate: "2026-04-01" }), "2026-04-01")).toBe(501);
  });
});
