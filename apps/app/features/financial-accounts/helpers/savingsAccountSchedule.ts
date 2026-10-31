import type { SavingsAccountDetailsInput } from "../../../local-db/repositories/savings/savingsAccountDetails";

export function preservedSavingsAccountSchedule(details: SavingsAccountDetailsInput | null) {
  return {
    plannedContributionAmountCentavos: details?.plannedContributionAmountCentavos ?? null,
    contributionFrequency: details?.contributionFrequency ?? null,
    contributionIntervalCount: details?.contributionIntervalCount ?? null,
    contributionDayOfMonth: details?.contributionDayOfMonth ?? null,
    contributionSecondDayOfMonth: details?.contributionSecondDayOfMonth ?? null,
    contributionDayOfWeek: details?.contributionDayOfWeek ?? null,
    customIntervalDays: details?.customIntervalDays ?? null,
    nextContributionDate: details?.nextContributionDate ?? null,
  };
}
