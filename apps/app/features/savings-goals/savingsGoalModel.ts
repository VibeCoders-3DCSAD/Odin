import type { SavingsActivity, SavingsGoalProgress } from "./types";

function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(Math.abs(value)) : Math.round(value);
}

export function calculateSavingsGoalProgress(
  openingBalanceCentavos: number,
  targetAmountCentavos: number,
  activities: SavingsActivity[],
  requiredContributionCentavos = 0,
): SavingsGoalProgress {
  const activityBalance = activities.reduce((total, activity) => (
    total + (activity.kind === "contribution" ? activity.amountCentavos : -activity.amountCentavos)
  ), 0);
  const currentAmountCentavos = roundHalfUp(openingBalanceCentavos + activityBalance);
  const remainingAmountCentavos = Math.max(0, targetAmountCentavos - currentAmountCentavos);
  const progressPercent = targetAmountCentavos > 0
    ? Math.min(100, Math.max(0, roundHalfUp((currentAmountCentavos / targetAmountCentavos) * 100)))
    : 0;
  const contributions = activities
    .filter((activity) => activity.kind === "contribution")
    .reduce((total, activity) => total + activity.amountCentavos, 0);

  return {
    currentAmountCentavos,
    remainingAmountCentavos,
    progressPercent,
    isAchieved: currentAmountCentavos >= targetAmountCentavos,
    contributionShortfallCentavos: Math.max(0, requiredContributionCentavos - contributions),
  };
}

export function calculateEmergencyFundCoverageTarget(
  monthlyEssentialExpensesCentavos: number,
  coverageMonths: number,
): number {
  return roundHalfUp(monthlyEssentialExpensesCentavos * coverageMonths);
}
