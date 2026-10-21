import { interestToday } from "./savingsInterestConfiguration";
import type { SavingsAccountDetailsInput } from "../../../local-db/repositories/savingsAccountDetails";
import { normalizeSavingsInterestReference, validateScheduledInterest, type SavingsInterestReference } from "@odin/savings-interest";
import { preservedSavingsAccountSchedule } from "./savingsAccountSchedule";

export function buildSavingsInterestDetails(saved: SavingsAccountDetailsInput | null, rate: string, reference: SavingsInterestReference | null): SavingsAccountDetailsInput {
  const value = reference?.method === "none" ? "0" : rate.trim();
  const rateBps = value ? Math.round(Number(value) * 100) : null;
  if (value && (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isSafeInteger(rateBps) || rateBps! < 0)) {
    throw new Error("Enter a valid annual interest rate with up to two decimal places.");
  }
  const details: SavingsAccountDetailsInput = saved ? { ...saved } : {
    accountType: "personal_savings", interestRateBps: null, minimumBalanceCentavos: null,
    baseInterestRateBps: null, effectiveInterestRateBps: null, interestConditions: null, higherRateEligible: null,
    boostedInterestRateBps: null, interestCalculationBasis: null, interestCreditFrequency: null,
    maximumEligibleBalanceCentavos: null, balanceTiers: null, requiredDepositCentavos: null,
    requiredDepositFrequency: null, requiredTransactionCount: null, requiredTransactionPeriod: null,
    directDepositThresholdCentavos: null, qualificationPeriod: null, promotionalInterestRateBps: null,
    promotionStartDate: null, promotionEndDate: null, principalCentavos: null, maturityDate: null,
    termMonths: null, earlyWithdrawalRule: null, ...preservedSavingsAccountSchedule(null),
  };
  if (details.accountType === "high_yield_savings") details.baseInterestRateBps = rateBps;
  else details.interestRateBps = rateBps;
  details.interestReference = normalizeSavingsInterestReference(reference);
  const config = details.interestReference?.configuration;
  if (config && reference?.method !== "none") {
    if (rateBps === null || rateBps > 100000) throw new Error("Enter a nominal annual interest rate between 0 and 1000%.");
    const savedConfig = saved?.interestReference?.configuration;
    if (config.startsOn < interestToday() && config.startsOn !== savedConfig?.startsOn && config.startingBalanceCentavos === null) throw new Error("Enter the starting balance for a backdated interest start.");
    if (savedConfig && savedConfig.rateHistory.some((entry, index) => entry.effectiveOn !== config.rateHistory[index]?.effectiveOn || entry.rateBps !== config.rateHistory[index]?.rateBps)) throw new Error("Preserve saved rate history and add a new effective-dated rate instead.");
    if (!config.rateHistory.length) config.rateHistory = [{ effectiveOn: config.startsOn, rateBps }];
    else if (!savedConfig && config.rateHistory[0]!.effectiveOn > config.startsOn) config.rateHistory = [{ effectiveOn: config.startsOn, rateBps }, ...config.rateHistory];
    details.interestReference = normalizeSavingsInterestReference(details.interestReference);
  }
  validateScheduledInterest(details.interestReference, rateBps);
  return details;
}
