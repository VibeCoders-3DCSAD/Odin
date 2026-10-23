import type { SavingsGoal } from "../../../local-db/repositories/savingsGoals";
import type { SavingsActivity } from "../../savings-goals/types";
import { getScheduledContributionDates, validateContributionSchedule } from "../../savings-goals/contributionSchedule";
import type { DashboardReminder } from "../types";

export function buildSavingsReminders(goals: SavingsGoal[], activities: Map<string, SavingsActivity[]>, today: string, through: string): DashboardReminder[] {
  return goals.flatMap((goal) => {
    if (goal.status !== "active" || goal.isAchieved || goal.remainingAmountCentavos <= 0 || validateContributionSchedule(goal) || !goal.nextContributionDate) return [];
    const dates = getScheduledContributionDates(goal, goal.nextContributionDate, goal.targetDate && goal.targetDate < through ? goal.targetDate : through);
    // Contributions cover the earliest scheduled occurrence first, including early payments.
    let paid = (activities.get(goal.id) ?? []).filter((activity) => activity.kind === "contribution" && activity.activityDate >= goal.nextContributionDate! && activity.activityDate <= today).reduce((sum, activity) => sum + activity.amountCentavos, 0);
    let remaining = goal.remainingAmountCentavos;
    return dates.flatMap((dueDate) => {
      const target = goal.plannedContributionAmountCentavos;
      const applied = Math.min(target, paid);
      paid -= applied;
      if (dueDate < today) return [];
      const amountCentavos = Math.min(remaining, target - applied);
      remaining -= amountCentavos;
      return dueDate >= today && amountCentavos > 0 ? [{ id: `savings:${goal.id}:${dueDate}`, title: goal.name, detail: "Savings contribution", amountCentavos, date: dueDate, target: { kind: "savings" as const, id: goal.id } }] : [];
    });
  });
}
