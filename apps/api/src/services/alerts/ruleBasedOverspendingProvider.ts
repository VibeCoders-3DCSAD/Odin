import type {
  AlertSeverity,
  DetectionResult,
  OverspendingProvider,
  OverspendingProviderInput,
} from "./types.js";

export class RuleBasedOverspendingProvider implements OverspendingProvider {
  evaluate(input: OverspendingProviderInput): DetectionResult {
    const { allocation } = input;
    const evaluatedAt = (input.now ?? new Date()).toISOString();
    const actual = input.transactions
      .filter(
        (transaction) =>
          transaction.transaction_type === "expense" &&
          transaction.transaction_date >= allocation.cycle_start &&
          transaction.transaction_date <= allocation.cycle_end &&
          matchesAllocation(transaction, allocation),
      )
      .reduce((sum, transaction) => sum + transaction.amount_centavos, 0);
    const overspent = Math.max(0, actual - allocation.amount_centavos);
    const overspentPercent = allocation.amount_centavos === 0 ? 0 : Math.round((overspent / allocation.amount_centavos) * 100);
    const shouldAlert = overspent > 0;

    return {
      category: "budget_overspending",
      evaluated_at: evaluatedAt,
      decision: shouldAlert ? "alert" : "no_alert",
      should_alert_user: shouldAlert,
      severity: shouldAlert ? overspendingSeverity(overspentPercent) : null,
      explanation: shouldAlert
        ? `Spending is ${overspentPercent}% above this allocation.`
        : "Spending is within this allocation.",
      feature_drivers: [
        {
          key: "allocation_usage",
          label: "Current-cycle spending against allocation",
          value_centavos: actual,
          baseline_centavos: allocation.amount_centavos,
          deviation_percent: allocation.amount_centavos === 0 ? null : Math.round(((actual - allocation.amount_centavos) / allocation.amount_centavos) * 100),
        },
      ],
      references: {
        budget_id: allocation.budget_id,
        budget_allocation_id: allocation.budget_allocation_id,
        subcategory_id: allocation.subcategory_id ?? undefined,
      },
      suppression: { suppressed: false, reason: "none" },
    };
  }
}

function matchesAllocation(transaction: OverspendingProviderInput["transactions"][number], allocation: OverspendingProviderInput["allocation"]): boolean {
  return allocation.subcategory_id === null
    ? transaction.category_id === allocation.category_id
    : transaction.subcategory_id === allocation.subcategory_id;
}

function overspendingSeverity(percent: number): AlertSeverity {
  if (percent >= 50) return "critical";
  if (percent >= 25) return "high";
  if (percent >= 10) return "medium";
  return "low";
}
