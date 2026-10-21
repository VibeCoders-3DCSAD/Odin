import { deriveGoalContributionDate, getTargetDateContributionAmount, type SavingsContributionSchedule } from "../contributionSchedule";

export function recommendGoalContribution(
  schedule: SavingsContributionSchedule,
  targetAmountCentavos: number,
  savedAmountCentavos: number,
  targetDate: string,
  today: string,
): number | null {
  if (!Number.isSafeInteger(targetAmountCentavos) || targetAmountCentavos <= 0 || !Number.isSafeInteger(savedAmountCentavos)) return null;
  const frequency = schedule.contributionFrequency;
  if (frequency === null) return null;
  try {
    const currentFrequency = ["daily", "weekly", "semi_monthly", "monthly"].includes(frequency);
    const nextContributionDate = currentFrequency ? deriveGoalContributionDate(schedule, today) : schedule.nextContributionDate;
    return getTargetDateContributionAmount(
      { ...schedule, plannedContributionAmountCentavos: 0, nextContributionDate },
      targetAmountCentavos - savedAmountCentavos,
      targetDate,
      today,
    );
  } catch {
    // An incomplete schedule has no recommendation until its days are selected.
    return null;
  }
}
