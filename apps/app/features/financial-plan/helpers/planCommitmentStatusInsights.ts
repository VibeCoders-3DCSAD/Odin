import type { FinancialPlanRecommendation, FinancialPlanReservation } from "../types";
import { planObligations, requirementReservations } from "./commitmentBudget";
import { commitmentPayments, type PlanCommitmentPayments } from "./commitmentPayments";

function statusSummary(label: string, rows: FinancialPlanReservation[], requirements: FinancialPlanReservation[], payments: PlanCommitmentPayments | null, savings = false): string | null {
  const statuses = commitmentPayments(rows, requirements, payments ?? { paidCentavos: {}, settledKeys: [] });
  if (!statuses.size) return null;
  if (!payments) return `${label}: status unavailable.`;
  const counts = { paid: 0, partial: 0, unpaid: 0 };
  for (const payment of statuses.values()) counts[payment.status] += 1;
  const parts = [
    counts.paid ? `${counts.paid} ${savings ? "done" : "paid"}` : null,
    counts.partial ? `${counts.partial} partial` : null,
    counts.unpaid ? `${counts.unpaid} ${savings ? "pending" : "unpaid"}` : null,
  ].filter((part): part is string => part !== null);
  return `${label}: ${parts.join(" · ")}.`;
}

// Counts scheduled payments/contributions using the same due amounts and statuses as the plan rows.
export function planCommitmentStatusInsights(plan: FinancialPlanRecommendation, payments: PlanCommitmentPayments | null): string[] {
  const selection = plan.inputSnapshot.commitmentSelection;
  const obligations = planObligations(plan);
  return [
    selection?.debtRepayments !== false ? statusSummary("Debt repayments", plan.recommendation.debtReservations, requirementReservations(plan.inputSnapshot.debtRequirements), payments) : null,
    selection?.savingsContributions !== false ? statusSummary("Savings contributions", plan.recommendation.savingsReservations, requirementReservations(plan.inputSnapshot.savingsRequirements), payments, true) : null,
    selection?.scheduledPayments !== false ? statusSummary("Billers & remittances", obligations.reservations, obligations.requirements, payments) : null,
  ].filter((message): message is string => message !== null);
}
