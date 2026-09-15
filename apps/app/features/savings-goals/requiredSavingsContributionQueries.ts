import { listSavingsGoalActivitiesByGoal } from "../../local-db/repositories/savingsGoalActivities";
import { listScheduledSavingsAccounts } from "../../local-db/repositories/savingsAccountDetails";
import { listSavingsGoals } from "../../local-db/repositories/savingsGoals";
import { getRequiredSavingsAccountContributions, getRequiredSavingsContributions, type RequiredSavingsContributionTotal, type ScheduledSavingsGoal } from "./contributionSchedule";

export type RequiredSavingsContributionsForPeriod = RequiredSavingsContributionTotal & {
  savingsNames: Record<string, string>;
};

export async function getRequiredSavingsContributionsForPeriod(
  userId: string,
  periodStart: string,
  periodEnd: string,
): Promise<RequiredSavingsContributionsForPeriod> {
  const [goals, accounts] = await Promise.all([listSavingsGoals(userId), listScheduledSavingsAccounts(userId)]);
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
  const goalRequirements = getRequiredSavingsContributions(periodStart, periodEnd, scheduledGoals, activitiesByGoal);
  const scheduledAccounts = accounts.flatMap((account) => account.plannedContributionAmountCentavos === null
    ? []
    : [{ ...account, id: account.accountId, plannedContributionAmountCentavos: account.plannedContributionAmountCentavos }]);
  const accountRequirements = getRequiredSavingsAccountContributions(periodStart, periodEnd, scheduledAccounts);
  return {
    totalRequiredCentavos: goalRequirements.totalRequiredCentavos + accountRequirements.totalRequiredCentavos,
    contributions: [...goalRequirements.contributions, ...accountRequirements.contributions],
    savingsNames: Object.fromEntries([
      ...goals.map((goal) => [goal.id, goal.name]),
      ...accounts.map((account) => [account.accountId, account.name]),
    ]),
  };
}
