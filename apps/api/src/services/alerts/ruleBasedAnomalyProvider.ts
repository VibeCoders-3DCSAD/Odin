import type {
  AlertSeverity,
  AnomalyProvider,
  AnomalyProviderInput,
  DetectionResult,
  FeatureDriver,
} from "./types.js";

const DEFAULT_MINIMUM_HISTORY_COUNT = 3;
const DEFAULT_ANOMALY_MULTIPLIER = 2;

export class RuleBasedAnomalyProvider implements AnomalyProvider {
  evaluate(input: AnomalyProviderInput): DetectionResult {
    const { transaction } = input;
    const evaluatedAt = (input.now ?? new Date()).toISOString();
    const history = input.historical_transactions.filter(
      (candidate) =>
        candidate.transaction_type === "expense" &&
        candidate.id !== transaction.id &&
        matchesSpendingGroup(candidate, transaction),
    );
    const minimumHistoryCount = input.minimum_history_count ?? DEFAULT_MINIMUM_HISTORY_COUNT;
     const references = { transaction_id: transaction.id, subcategory_id: transaction.subcategory_id ?? undefined, merchant_name: transaction.merchant_name ?? undefined };

    if (transaction.transaction_type !== "expense" || history.length < minimumHistoryCount) {
      return {
        category: "anomaly_detection",
        evaluated_at: evaluatedAt,
        decision: "insufficient_history",
        should_alert_user: false,
        severity: null,
        explanation: "Not enough comparable spending history to identify an unusual amount.",
        feature_drivers: [],
        references,
        suppression: { suppressed: false, reason: "none" },
      };
    }

    const baseline = Math.round(history.reduce((sum, item) => sum + item.amount_centavos, 0) / history.length);
    const multiplier = input.anomaly_multiplier ?? DEFAULT_ANOMALY_MULTIPLIER;
    const isAnomaly = transaction.amount_centavos >= baseline * multiplier;
    const deviationPercent = baseline === 0 ? null : Math.round(((transaction.amount_centavos - baseline) / baseline) * 100);
    const featureDrivers: FeatureDriver[] = [
      {
        key: "amount_vs_history",
        label: "Amount compared with comparable spending",
        value_centavos: transaction.amount_centavos,
        baseline_centavos: baseline,
        deviation_percent: deviationPercent,
      },
    ];

    return {
      category: "anomaly_detection",
      evaluated_at: evaluatedAt,
      decision: isAnomaly ? "alert" : "no_alert",
      should_alert_user: isAnomaly,
      severity: isAnomaly ? severityForDeviation(deviationPercent ?? 0) : null,
      explanation: isAnomaly
        ? `This expense is ${Math.max(0, deviationPercent ?? 0)}% above the comparable historical average.`
        : "This expense is within the normal range for comparable spending.",
      feature_drivers: featureDrivers,
      references,
      suppression: {
        suppressed: !isAnomaly,
        reason: !isAnomaly ? "expected_recurring_spending" : "none",
      },
    };
  }
}

function matchesSpendingGroup(left: AnomalyProviderInput["transaction"], right: AnomalyProviderInput["transaction"]): boolean {
  if (right.subcategory_id) return left.subcategory_id === right.subcategory_id;
  const merchant = right.merchant_name?.trim().toLowerCase();
  return Boolean(merchant && left.merchant_name?.trim().toLowerCase() === merchant);
}

function severityForDeviation(deviationPercent: number): AlertSeverity {
  if (deviationPercent >= 200) return "critical";
  if (deviationPercent >= 100) return "high";
  if (deviationPercent >= 50) return "medium";
  return "low";
}
