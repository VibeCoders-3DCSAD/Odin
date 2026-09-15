import { listSavingsGoalActivitiesByGoal } from "../../local-db/repositories/savingsGoalActivities";
import { listSavingsGoals } from "../../local-db/repositories/savingsGoals";
import { getRequiredSavingsContributions, type RequiredSavingsContributionTotal, type ScheduledSavingsGoal } from "./contributionSchedule";

export async function getRequiredSavingsContributionsForPeriod(
  userId: string,
  periodStart: string,
  periodEnd: string,
): Promise<RequiredSavingsContributionTotal> {
  const goals = await listSavingsGoals(userId);
  const activitiesByGoal = await listSavingsGoalActivitiesByGoal(userId, goals.map((goal) => goal.id));
  const scheduledGoals: ScheduledSavingsGoal[] = goals.map((goal) => ({
    id: goal.id,
    status: goal.status,
    remainingAmountCentavos: goal.remainingAmountCentavos,
    isAchieved: goal.isAchieved,
    targetDate: goal.targetDate,
    plannedContributionAmountCentavos: goal.plannedContributionAmountCentavos,
    contributionFrequency: goal.contributionFrequency,
    contributionIntervalCount: goal.contributionIntervalCount,
    contributionDayOfMonth: goal.contributionDayOfMonth,
    contributionSecondDayOfMonth: goal.contributionSecondDayOfMonth,
    contributionDayOfWeek: goal.contributionDayOfWeek,
    customIntervalDays: goal.customIntervalDays,
    nextContributionDate: goal.nextContributionDate,
  }));
  return getRequiredSavingsContributions(periodStart, periodEnd, scheduledGoals, activitiesByGoal);
}
