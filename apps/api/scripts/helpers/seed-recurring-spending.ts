import { randomUUID } from "node:crypto";
import { detectUnusualSpendings, UNUSUAL_SPENDING_MODEL_VERSION } from "@odin/spending-insights";
import type { Transaction } from "../seed-history.js";

// Medicine purchases in the generated history are regular spending, even when IQR flags their variation.
export function buildSeedRecurringSpending(userId: string, transactions: Transaction[], subcategoryIds: Map<string, string>, today: string) {
  const medicineId = subcategoryIds.get("health_medicines");
  if (!medicineId) return [];
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 12);
  const fromDate = start.toISOString().slice(0, 10);
  const medicines = transactions.filter((transaction) => transaction.user_id === userId
    && transaction.transaction_type === "expense" && transaction.subcategory_id === medicineId
    && transaction.transaction_date >= fromDate && transaction.transaction_date <= today
    && transaction.amount_centavos > 0);
  const insights = detectUnusualSpendings(medicines.map((transaction) => ({
    id: transaction.id, transactionDate: transaction.transaction_date, amountCentavos: transaction.amount_centavos,
    subcategoryId: medicineId, subcategoryLabel: "Medicines", accountName: null,
  })));
  const timestamp = `${today}T12:00:00+08:00`;
  return insights.map((insight) => ({
    id: randomUUID(), user_id: userId, transaction_id: insight.transactionId,
    subcategory_id: insight.subcategoryId, amount_centavos: insight.amountCentavos,
    evaluated_at: timestamp, confirmed_recurring_at: timestamp, recurrence: "frequent",
    model_version: UNUSUAL_SPENDING_MODEL_VERSION, profile_label: null,
    history_days: insight.usableHistoryCount, raw_anomaly_score: insight.severity,
    is_anomaly: true, should_alert_user: false, review_status: "not_alerted",
    feature_vector: {
      usual_spending_centavos: insight.usualSpendingCentavos,
      lower_bound_centavos: insight.lowerBoundCentavos,
      upper_bound_centavos: insight.upperBoundCentavos,
    },
    baseline_snapshot: { scope: "category_iqr" }, version: 1, deleted: false, updated_at: timestamp,
  }));
}
