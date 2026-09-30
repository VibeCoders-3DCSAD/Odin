import { getAcceptedFinancialPlanForPeriod, getNextFinancialPlanPeriod } from "../../local-db/repositories/financialPlans";
import { getSavingsAllocationStrategy } from "../../local-db/repositories/savingsAllocationPreferences";
import { listSavingsGoals } from "../../local-db/repositories/savingsGoals";
import { getRequiredSavingsContributionsForPeriod } from "./requiredSavingsContributionQueries";
import { allocateSavingsEnvelope, type SavingsEnvelopeAllocation } from "./savingsEnvelopeAllocation";

export async function getCurrentSavingsEnvelopeAllocation(userId: string, asOfDate: string): Promise<SavingsEnvelopeAllocation | null> {
  const period = getNextFinancialPlanPeriod(asOfDate);
  const plan = await getAcceptedFinancialPlanForPeriod(userId, period.start, period.end);
  if (!plan) return null;
  const [requirements, strategy, savedGoals] = await Promise.all([
    getRequiredSavingsContributionsForPeriod(userId, plan.periodStart, plan.periodEnd),
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
  const reservations = ((plan.recommendation.savingsReservations as Array<{ savingsGoalId?: string; amountCentavos?: number }> | undefined) ?? []);
  const reservedByGoalId = new Map<string, number>();
  for (const reservation of reservations) {
    if (!reservation.savingsGoalId || !Number.isSafeInteger(reservation.amountCentavos)) continue;
    reservedByGoalId.set(reservation.savingsGoalId, (reservedByGoalId.get(reservation.savingsGoalId) ?? 0) + Math.max(0, reservation.amountCentavos));
  }
  const envelopeCentavos = [...reservedByGoalId.values()].reduce((total, amount) => total + amount, 0);
  const allocation = allocateSavingsEnvelope(0, strategy, goals, accountRequiredCentavos);
  const proposals = allocation.proposals.map((proposal) => {
    const reserved = Math.min(proposal.remainingAmountCentavos, reservedByGoalId.get(proposal.id) ?? 0);
    const required = Math.min(proposal.remainingAmountCentavos, Math.max(0, proposal.requiredCentavos - proposal.recordedContributionCentavos));
    return { ...proposal, proposedRequiredCentavos: Math.min(required, reserved), proposedSurplusCentavos: Math.max(0, reserved - required), proposedTotalCentavos: reserved, unfundedRequiredCentavos: Math.max(0, required - reserved), state: reserved >= required ? "funded" as const : reserved > 0 ? "partially_funded" as const : "unfunded" as const, reason: reserved > 0 ? proposal.reason : "no_envelope" as const };
  });
  const requiredCentavos = accountRequiredCentavos + proposals.reduce((total, proposal) => total + Math.max(0, proposal.requiredCentavos - proposal.recordedContributionCentavos), 0);
  return { envelopeCentavos, requiredCentavos, accountRequiredCentavos, shortfallCentavos: Math.max(0, requiredCentavos - envelopeCentavos), unallocatedCentavos: Math.max(0, envelopeCentavos - proposals.reduce((total, proposal) => total + proposal.proposedTotalCentavos, 0)), proposals };
}
