import type { SavingsAllocationStrategy } from "../../local-db/repositories/savingsAllocationPreferences";

export type AllocatableSavingsGoal = {
  id: string;
  name: string;
  goalCategory: string;
  targetDate: string | null;
  remainingAmountCentavos: number;
  requiredCentavos: number;
  recordedContributionCentavos: number;
};

export type SavingsAllocationProposal = AllocatableSavingsGoal & {
  proposedRequiredCentavos: number;
  proposedSurplusCentavos: number;
  proposedTotalCentavos: number;
  unfundedRequiredCentavos: number;
  state: "funded" | "partially_funded" | "unfunded";
  reason: "emergency_fund_required" | "scheduled_required" | "avalanche_surplus" | "snowball_surplus" | "no_envelope";
};

export type SavingsEnvelopeAllocation = {
  envelopeCentavos: number;
  requiredCentavos: number;
  accountRequiredCentavos: number;
  shortfallCentavos: number;
  unallocatedCentavos: number;
  proposals: SavingsAllocationProposal[];
};

function byStrategy(strategy: SavingsAllocationStrategy, left: AllocatableSavingsGoal, right: AllocatableSavingsGoal) {
  const target = (left.targetDate ?? "9999-12-31").localeCompare(right.targetDate ?? "9999-12-31");
  return strategy === "avalanche"
    ? right.requiredCentavos - right.recordedContributionCentavos - (left.requiredCentavos - left.recordedContributionCentavos) || target || left.id.localeCompare(right.id)
    : left.remainingAmountCentavos - right.remainingAmountCentavos || target || left.id.localeCompare(right.id);
}

export function allocateSavingsEnvelope(envelopeCentavos: number, strategy: SavingsAllocationStrategy, goals: AllocatableSavingsGoal[], accountRequiredCentavos = 0): SavingsEnvelopeAllocation {
  const normalizedEnvelopeCentavos = Math.max(0, Math.trunc(envelopeCentavos));
  const normalizedAccountRequiredCentavos = Math.max(0, Math.trunc(accountRequiredCentavos));
  let available = Math.max(0, normalizedEnvelopeCentavos - normalizedAccountRequiredCentavos);
  const eligible = goals.filter((goal) => goal.remainingAmountCentavos > 0).map((goal) => ({ ...goal, requiredCentavos: Math.max(0, goal.requiredCentavos), recordedContributionCentavos: Math.max(0, goal.recordedContributionCentavos) }));
  const requiredCentavos = normalizedAccountRequiredCentavos + eligible.reduce((total, goal) => total + Math.max(0, goal.requiredCentavos - goal.recordedContributionCentavos), 0);
  const ordered = [...eligible].sort((left, right) => (left.goalCategory === "emergency_fund" ? -1 : right.goalCategory === "emergency_fund" ? 1 : byStrategy(strategy, left, right)));
  const proposals = ordered.map((goal) => {
    const required = Math.min(goal.remainingAmountCentavos, Math.max(0, goal.requiredCentavos - goal.recordedContributionCentavos));
    const proposedRequiredCentavos = Math.min(required, available);
    available -= proposedRequiredCentavos;
    return { ...goal, proposedRequiredCentavos, proposedSurplusCentavos: 0, proposedTotalCentavos: proposedRequiredCentavos, unfundedRequiredCentavos: required - proposedRequiredCentavos, state: (proposedRequiredCentavos === required ? "funded" : proposedRequiredCentavos > 0 ? "partially_funded" : "unfunded") as SavingsAllocationProposal["state"], reason: (goal.goalCategory === "emergency_fund" ? "emergency_fund_required" : proposedRequiredCentavos > 0 ? "scheduled_required" : "no_envelope") as SavingsAllocationProposal["reason"] };
  });
  for (const proposal of proposals) {
    if (available <= 0) break;
    const surplus = Math.min(available, proposal.remainingAmountCentavos - proposal.proposedTotalCentavos);
    proposal.proposedSurplusCentavos = surplus;
    proposal.proposedTotalCentavos += surplus;
    available -= surplus;
    if (surplus > 0 && proposal.proposedRequiredCentavos === 0) proposal.reason = proposal.goalCategory === "emergency_fund" ? "emergency_fund_required" : strategy === "avalanche" ? "avalanche_surplus" : "snowball_surplus";
  }
  return { envelopeCentavos: normalizedEnvelopeCentavos, requiredCentavos, accountRequiredCentavos: normalizedAccountRequiredCentavos, shortfallCentavos: Math.max(0, requiredCentavos - normalizedEnvelopeCentavos), unallocatedCentavos: available, proposals };
}
