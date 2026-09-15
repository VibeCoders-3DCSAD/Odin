import { getMinimumContributionPerOccurrence, getRequiredSavingsAccountContributions, getRequiredSavingsContributions, validateContributionSchedule, type ScheduledSavingsGoal } from "../contributionSchedule";

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

  it("uses centavo ceiling rounding across remaining occurrences when the plan is lower", () => {
    expect(getMinimumContributionPerOccurrence(goal({ plannedContributionAmountCentavos: 0 }), "2026-04-01")).toBe(201);
  });

  it("requires the planned amount for every occurrence when it exceeds the target-date minimum", () => {
    const result = getRequiredSavingsContributions("2026-04-01", "2026-04-15", [
      goal(),
      goal({ id: "achieved", isAchieved: true }),
    ], new Map([["goal-1", [{ id: "activity-1", savingsGoalId: "goal-1", transactionId: "transaction-1", kind: "contribution", amountCentavos: 100, activityDate: "2026-04-02", notes: null, version: 1 }]]]));

    expect(result).toEqual({
      totalRequiredCentavos: 900,
      contributions: [expect.objectContaining({ savingsId: "goal-1", source: "goal", scheduledDates: ["2026-04-02", "2026-04-09"], minimumPerOccurrenceCentavos: 500, configuredMinimumCentavos: 1_000, recordedContributionCentavos: 100, remainingRequiredCentavos: 900 })],
    });
  });

  it("uses the two configured monthly days for semi-monthly schedules", () => {
    expect(getMinimumContributionPerOccurrence(goal({ contributionFrequency: "semi_monthly", contributionDayOfMonth: 1, contributionSecondDayOfMonth: 15, nextContributionDate: "2026-04-01" }), "2026-04-01")).toBe(501);
  });

  it("includes each due Personal Savings or HYSA contribution in the budget period", () => {
    const result = getRequiredSavingsAccountContributions("2026-09-25", "2026-10-25", [{
      id: "hysa-1", plannedContributionAmountCentavos: 500_000,
      contributionFrequency: "monthly", contributionIntervalCount: 1,
      contributionDayOfMonth: null, contributionSecondDayOfMonth: null,
      contributionDayOfWeek: null, customIntervalDays: null, nextContributionDate: "2026-10-14",
    }]);

    expect(result).toEqual({
      totalRequiredCentavos: 500_000,
      contributions: [expect.objectContaining({ savingsId: "hysa-1", source: "savings_account", scheduledDates: ["2026-10-14"], remainingRequiredCentavos: 500_000 })],
    });
  });
});
