import { recommendGoalContribution } from "../helpers/contributionRecommendation";
import type { SavingsContributionSchedule } from "../contributionSchedule";

const schedule: SavingsContributionSchedule = {
  contributionFrequency: "monthly", contributionIntervalCount: 1,
  contributionDayOfMonth: 31, contributionSecondDayOfMonth: null,
  contributionDayOfWeek: null, customIntervalDays: null,
  nextContributionDate: null, plannedContributionAmountCentavos: 50_000,
};

describe("goal contribution recommendations", () => {
  it.each([
    [{ contributionFrequency: "daily" }, 31],
    [{ contributionFrequency: "weekly", contributionDayOfWeek: 1 }, 5],
    [{ contributionFrequency: "semi_monthly", contributionDayOfMonth: 1, contributionSecondDayOfMonth: 15 }, 2],
    [{ contributionFrequency: "monthly" }, 1],
  ] as const)("counts actual dates for %o and rounds up to a centavo", (timing, count) => {
    expect(recommendGoalContribution({ ...schedule, ...timing }, 10_001, 1_000, "2026-03-31", "2026-03-01")).toBe(Math.ceil(9_001 / count));
  });

  it("includes today and the target date, restoring day 31 after February", () => {
    expect(recommendGoalContribution(schedule, 10_001, 0, "2027-03-31", "2027-01-31")).toBe(3_334);
  });

  it.each([
    ["2026-02-30", "2026-01-01", 10_000, 0],
    ["2026-02-01", "2026-03-01", 10_000, 0],
    ["2026-03-30", "2026-03-01", 10_000, 0],
    ["2026-03-31", "2026-03-01", Number.NaN, 0],
    ["2026-03-31", "2026-03-01", 10_000, Number.NaN],
    ["2026-03-31", "2026-03-01", 10_000, 10_000],
  ])("does not suggest for invalid or completed targets", (targetDate, today, target, saved) => {
    expect(recommendGoalContribution(schedule, target, saved, targetDate, today)).toBeNull();
  });

  it.each([
    { contributionFrequency: null },
    { contributionFrequency: "weekly", contributionDayOfWeek: null },
    { contributionFrequency: "monthly", contributionDayOfMonth: null },
    { contributionFrequency: "semi_monthly", contributionDayOfMonth: 20, contributionSecondDayOfMonth: 5 },
  ] as const)("does not suggest for absent or incomplete schedules: %o", (timing) => {
    expect(recommendGoalContribution({ ...schedule, ...timing }, 10_000, 0, "2026-03-31", "2026-03-01")).toBeNull();
  });
});
