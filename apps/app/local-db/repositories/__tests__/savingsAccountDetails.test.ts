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
    principalCentavos: null,
    maturityDate: null,
    termMonths: null,
    earlyWithdrawalRule: null,
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
    expect(validateSavingsAccountDetails(details({ accountType: "high_yield_savings", baseInterestRateBps: 300, effectiveInterestRateBps: 450, interestConditions: "Maintain PHP 100,000 monthly balance", higherRateEligible: true }))).toMatchObject({ accountType: "high_yield_savings" });
    expect(validateSavingsAccountDetails(details({ accountType: "time_deposit", principalCentavos: 100_000_00, maturityDate: "2027-01-01", termMonths: 12, earlyWithdrawalRule: "Early withdrawal may reduce earned interest" }))).toMatchObject({ accountType: "time_deposit" });
  });

  it("uses the effective HYSA rate only when eligibility is confirmed", () => {
    const hysa = details({ accountType: "high_yield_savings", baseInterestRateBps: 300, effectiveInterestRateBps: 450, interestConditions: "Maintain the required balance", higherRateEligible: true });
    expect(getApplicableSavingsInterestRateBps(hysa)).toBe(450);
    expect(getApplicableSavingsInterestRateBps({ ...hysa, higherRateEligible: false })).toBe(300);
  });
});
