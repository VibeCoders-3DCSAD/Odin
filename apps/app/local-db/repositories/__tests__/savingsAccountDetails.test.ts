import { getApplicableSavingsInterestRateBps, validateSavingsAccountDetails, type SavingsAccountDetailsInput } from "../savingsAccountDetails";

function details(overrides: Partial<SavingsAccountDetailsInput> = {}): SavingsAccountDetailsInput {
  return {
    accountType: "personal_savings",
    interestRateBps: 425,
    minimumBalanceCentavos: 100_00,
    baseInterestRateBps: null,
    effectiveInterestRateBps: null,
    interestConditions: null,
    higherRateEligible: null,
    boostedInterestRateBps: null,
    interestCalculationBasis: null,
    interestCreditFrequency: null,
    maximumEligibleBalanceCentavos: null,
    balanceTiers: null,
    requiredDepositCentavos: null,
    requiredDepositFrequency: null,
    requiredTransactionCount: null,
    requiredTransactionPeriod: null,
    directDepositThresholdCentavos: null,
    qualificationPeriod: null,
    promotionalInterestRateBps: null,
    promotionStartDate: null,
    promotionEndDate: null,
    principalCentavos: null,
    maturityDate: null,
    termMonths: null,
    earlyWithdrawalRule: null,
    plannedContributionAmountCentavos: 10_000,
    contributionFrequency: "monthly",
    contributionIntervalCount: 1,
    contributionDayOfMonth: null,
    contributionSecondDayOfMonth: null,
    contributionDayOfWeek: null,
    customIntervalDays: null,
    nextContributionDate: "2026-04-30",
    ...overrides,
  };
}

describe("savings account detail validation", () => {
  it("accepts a complete Personal Savings account", () => {
    expect(validateSavingsAccountDetails(details())).toMatchObject({ accountType: "personal_savings" });
  });

  it("requires the fields specific to HYSA and Time Deposit", () => {
    expect(() => validateSavingsAccountDetails(details({ accountType: "high_yield_savings" }))).toThrow("HYSA requires");
    expect(() => validateSavingsAccountDetails(details({ accountType: "time_deposit" }))).toThrow("Time Deposit requires");
    expect(validateSavingsAccountDetails(details({ accountType: "high_yield_savings", baseInterestRateBps: 300, interestCalculationBasis: "daily_ending_balance", interestCreditFrequency: "monthly" }))).toMatchObject({ accountType: "high_yield_savings" });
    expect(validateSavingsAccountDetails(details({ accountType: "time_deposit", principalCentavos: 100_000_00, maturityDate: "2027-01-01", termMonths: 12, earlyWithdrawalRule: "Early withdrawal may reduce earned interest" }))).toMatchObject({ accountType: "time_deposit" });
  });

  it("keeps Goal Savings as its own holding record", () => {
    expect(() => validateSavingsAccountDetails(details({ accountType: "goal_savings" }))).toThrow("Savings goals screen");
  });

  it("uses the effective HYSA rate only when eligibility is confirmed", () => {
    const hysa = details({ accountType: "high_yield_savings", baseInterestRateBps: 300, effectiveInterestRateBps: 450, interestConditions: "Maintain the required balance", higherRateEligible: true });
    expect(getApplicableSavingsInterestRateBps(hysa)).toBe(450);
    expect(getApplicableSavingsInterestRateBps({ ...hysa, higherRateEligible: false })).toBe(300);
  });

  it("accepts persisted HYSA yield inputs and rejects overlapping tiers", () => {
    const hysa = details({ accountType: "high_yield_savings", baseInterestRateBps: 300, boostedInterestRateBps: 450, interestCalculationBasis: "daily_ending_balance", interestCreditFrequency: "monthly", minimumBalanceCentavos: 10_000_00, maximumEligibleBalanceCentavos: 100_000_00, balanceTiers: [{ minimumBalanceCentavos: 0, maximumBalanceCentavos: 49_999_99, interestRateBps: 400 }, { minimumBalanceCentavos: 50_000_00, maximumBalanceCentavos: 100_000_00, interestRateBps: 450 }], requiredDepositCentavos: 1_000_00, requiredDepositFrequency: "monthly", requiredTransactionCount: 5, requiredTransactionPeriod: "monthly", directDepositThresholdCentavos: 10_000_00, qualificationPeriod: "monthly", promotionalInterestRateBps: 500, promotionStartDate: "2026-01-01", promotionEndDate: "2026-03-31" });
    expect(validateSavingsAccountDetails(hysa)).toMatchObject({ maximumEligibleBalanceCentavos: 100_000_00 });
    expect(() => validateSavingsAccountDetails({ ...hysa, balanceTiers: [{ minimumBalanceCentavos: 0, maximumBalanceCentavos: 50_000_00, interestRateBps: 400 }, { minimumBalanceCentavos: 50_000_00, maximumBalanceCentavos: 100_000_00, interestRateBps: 450 }] })).toThrow("cannot overlap");
  });
});
