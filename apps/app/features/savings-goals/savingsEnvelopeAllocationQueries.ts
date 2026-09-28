import { getCurrentBudgetDraft } from "../../local-db/repositories/budgets";
import { getSavingsAllocationStrategy } from "../../local-db/repositories/savingsAllocationPreferences";
import { listSavingsGoals } from "../../local-db/repositories/savingsGoals";
import { getRequiredSavingsContributionsForPeriod } from "./requiredSavingsContributionQueries";
import { allocateSavingsEnvelope, type SavingsEnvelopeAllocation } from "./savingsEnvelopeAllocation";

export async function getCurrentSavingsEnvelopeAllocation(userId: string, asOfDate: string): Promise<SavingsEnvelopeAllocation | null> {
  const budget = await getCurrentBudgetDraft(userId, asOfDate);
  if (!budget) return null;
  const [requirements, strategy, savedGoals] = await Promise.all([
    getRequiredSavingsContributionsForPeriod(userId, budget.periodStart, budget.periodEnd),
    getSavingsAllocationStrategy(userId),
    listSavingsGoals(userId),
  ]);
  const requirementsByGoalId = new Map(requirements.contributions.filter((contribution) => contribution.source === "goal").map((contribution) => [contribution.savingsId, contribution]));
  const accountRequiredCentavos = requirements.contributions.filter((contribution) => contribution.source === "savings_account").reduce((total, contribution) => total + contribution.remainingRequiredCentavos, 0);
  const goals = savedGoals.filter((goal) => goal.status === "active" && !goal.isAchieved && goal.remainingAmountCentavos > 0 && goal.contributionFrequency !== null && goal.nextContributionDate !== null).map((goal) => {
    const requirement = requirementsByGoalId.get(goal.id);
    return {
      id: goal.id,
      name: goal.name,
      goalCategory: goal.goalCategory,
      targetDate: goal.targetDate,
      remainingAmountCentavos: goal.remainingAmountCentavos,
      requiredCentavos: requirement?.configuredMinimumCentavos ?? 0,
      recordedContributionCentavos: requirement?.recordedContributionCentavos ?? 0,
    };
  });
  return allocateSavingsEnvelope(budget.savingsBudgetAmountMinor, strategy, goals, accountRequiredCentavos);
}
