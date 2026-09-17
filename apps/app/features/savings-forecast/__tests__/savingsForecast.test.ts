import { buildSavingsForecast } from "../savingsForecast";

const schedule = {
  plannedContributionAmountCentavos: 10_000,
  contributionFrequency: "monthly" as const,
  contributionIntervalCount: 1,
  contributionDayOfMonth: null,
  contributionSecondDayOfMonth: null,
  contributionDayOfWeek: null,
  customIntervalDays: null,
  nextContributionDate: "2026-02-01",
};

describe("buildSavingsForecast", () => {
  it("projects scheduled contributions upward and marks a goal ahead of target", () => {
    const forecast = buildSavingsForecast({ currentBalanceCentavos: 10_000, startingBalanceCentavos: 10_000, targetAmountCentavos: 30_000, targetDate: "2026-04-01", schedule, interestRateBps: 0, asOf: "2026-01-15" });

    expect(forecast.status).toBe("ahead");
    expect(forecast.projectedTargetDate).toBe("2026-03-01");
    expect(forecast.points.filter((point) => point.event === "scheduled_contribution")).toHaveLength(2);
  });

  it("uses the base HYSA rate until higher-rate eligibility is confirmed", () => {
    const forecast = buildSavingsForecast({ currentBalanceCentavos: 100_000_00, startingBalanceCentavos: 100_000_00, schedule, interestRateBps: null, asOf: "2026-01-01", details: {
      accountId: "hysa-1", accountType: "high_yield_savings", interestRateBps: null, minimumBalanceCentavos: null, baseInterestRateBps: 300, effectiveInterestRateBps: 500, interestConditions: null, higherRateEligible: null, boostedInterestRateBps: 500, interestCalculationBasis: "daily_ending_balance", interestCreditFrequency: "monthly", maximumEligibleBalanceCentavos: null, balanceTiers: null, requiredDepositCentavos: null, requiredDepositFrequency: null, requiredTransactionCount: null, requiredTransactionPeriod: null, directDepositThresholdCentavos: null, qualificationPeriod: null, promotionalInterestRateBps: null, promotionStartDate: null, promotionEndDate: null, principalCentavos: null, maturityDate: null, termMonths: null, earlyWithdrawalRule: null, plannedContributionAmountCentavos: 10_000, contributionFrequency: "monthly", contributionIntervalCount: 1, contributionDayOfMonth: null, contributionSecondDayOfMonth: null, contributionDayOfWeek: null, customIntervalDays: null, nextContributionDate: "2026-02-01", version: 1,
    } });

    expect(forecast.points.find((point) => point.event === "interest_credit")?.interestCentavos).toBe(25_479);
    expect(forecast.interestExplanation).toContain("base rate");
  });

  it("uses an active promotional HYSA rate before the normal rate", () => {
    const forecast = buildSavingsForecast({ currentBalanceCentavos: 100_000_00, startingBalanceCentavos: 100_000_00, schedule, interestRateBps: null, asOf: "2026-01-01", details: {
      accountId: "hysa-1", accountType: "high_yield_savings", interestRateBps: null, minimumBalanceCentavos: null, baseInterestRateBps: 300, effectiveInterestRateBps: null, interestConditions: null, higherRateEligible: false, boostedInterestRateBps: null, interestCalculationBasis: "daily_ending_balance", interestCreditFrequency: "monthly", maximumEligibleBalanceCentavos: null, balanceTiers: null, requiredDepositCentavos: null, requiredDepositFrequency: null, requiredTransactionCount: null, requiredTransactionPeriod: null, directDepositThresholdCentavos: null, qualificationPeriod: null, promotionalInterestRateBps: 600, promotionStartDate: "2026-01-01", promotionEndDate: "2026-02-28", principalCentavos: null, maturityDate: null, termMonths: null, earlyWithdrawalRule: null, plannedContributionAmountCentavos: 10_000, contributionFrequency: "monthly", contributionIntervalCount: 1, contributionDayOfMonth: null, contributionSecondDayOfMonth: null, contributionDayOfWeek: null, customIntervalDays: null, nextContributionDate: "2026-02-01", version: 1,
    } });

    expect(forecast.points.find((point) => point.event === "interest_credit")?.interestCentavos).toBe(50_959);
  });

  it("advances semi-monthly schedules using their configured days", () => {
    const forecast = buildSavingsForecast({
      currentBalanceCentavos: 10_000,
      startingBalanceCentavos: 10_000,
      schedule: { ...schedule, contributionFrequency: "semi_monthly", contributionDayOfMonth: 5, contributionSecondDayOfMonth: 20, nextContributionDate: "2026-01-05" },
      interestRateBps: 0,
      asOf: "2026-01-01",
    });

    expect(forecast.points.filter((point) => point.event === "scheduled_contribution").map((point) => point.date).slice(0, 4)).toEqual(["2026-01-05", "2026-01-20", "2026-02-05", "2026-02-20"]);
  });
});
