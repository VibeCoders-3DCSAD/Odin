import { trustedMlHeaders } from "../../lib/mlInferenceGateway.js";
import type { AnomalyModelAdapter, ModelFinding } from "./dailyReportService.js";

type ReportTransaction = {
  id: string;
  amount_centavos: number;
  transaction_date: string;
  transaction_type: "expense";
  category_id: string | null;
  subcategory_id: string | null;
  merchant_name: string | null;
};

type MlDecision = {
  transaction_id?: unknown;
  state?: unknown;
  severity?: unknown;
  historical_median?: unknown;
  usual_spending?: unknown;
  reason?: unknown;
};

function unavailableFinding(reportDate: string, explanation: string): ModelFinding {
  return {
    candidate_key: `model:${reportDate}`,
    finding: "model_unavailable",
    severity: null,
    explanation,
    source_references: {},
    anomaly_score: null,
  };
}

function categoryIdentifier(transaction: ReportTransaction): string {
  const identifier = transaction.subcategory_id ?? transaction.category_id ?? "uncategorized";
  const scope = transaction.subcategory_id ? "subcategory" : "category";
  return `${scope}_${identifier.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}`;
}

export class MlAlertProvider implements AnomalyModelAdapter {
  readonly version = "personal-transaction-iqr-v2.3.0";

  async evaluate(input: { user_id: string; report_date: string; transactions: Record<string, unknown>[] }): Promise<ModelFinding[]> {
    const transactions = input.transactions as ReportTransaction[];
    if (transactions.length === 0) return [];

    const baseUrl = process.env.ML_SERVICE_URL?.replace(/\/$/, "");
    const requestBody = JSON.stringify({
      transactions: transactions.map((transaction) => ({
        transaction_id: transaction.id,
        date: transaction.transaction_date,
        amount: transaction.amount_centavos / 100,
        category: categoryIdentifier(transaction),
        transaction_type: transaction.transaction_type,
        description: transaction.merchant_name,
      })),
    });
    const headers = trustedMlHeaders(input.user_id, requestBody);
    if (!baseUrl || !headers) return [unavailableFinding(input.report_date, "Anomaly detection is not configured.")];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(`${baseUrl}/api/v1/anomaly/detect`, {
        method: "POST",
        headers,
        body: requestBody,
        signal: controller.signal,
      });
      if (!response.ok) return [unavailableFinding(input.report_date, "Anomaly detection is temporarily unavailable.")];

      const responseBody: unknown = await response.json();
      const decisions = (responseBody as { decisions?: unknown }).decisions;
      if (!Array.isArray(decisions)) return [unavailableFinding(input.report_date, "Anomaly detection returned an invalid response.")];

      const transactionsById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
      return decisions.flatMap((value): ModelFinding[] => {
        const decision = value as MlDecision;
        if (typeof decision.transaction_id !== "string") return [];
        const transaction = transactionsById.get(decision.transaction_id);
        if (!transaction) return [];
        const anomalous = decision.state === "ANOMALOUS";
        const insufficientHistory = decision.state === "INSUFFICIENT_HISTORY" || decision.state === "INSUFFICIENT_VARIABILITY";
        const usualSpending = typeof decision.usual_spending === "number" && Number.isFinite(decision.usual_spending) && decision.usual_spending > 0
          ? decision.usual_spending
          : typeof decision.historical_median === "number" && Number.isFinite(decision.historical_median) && decision.historical_median > 0
            ? decision.historical_median
            : null;
        const usualSpendingPercent = anomalous && usualSpending !== null
          ? ((transaction.amount_centavos / 100 - usualSpending) / usualSpending) * 100
          : null;
        return [{
          candidate_key: `transaction:${transaction.id}`,
          finding: anomalous ? "unusual_transaction" : insufficientHistory ? "insufficient_history" : "no_finding",
          severity: anomalous ? "warning" : null,
          explanation: usualSpendingPercent === null
            ? typeof decision.reason === "string" ? decision.reason : null
            : `This spending is ${Math.abs(usualSpendingPercent).toFixed(2)}% ${usualSpendingPercent >= 0 ? "higher" : "lower"} than your usual spending.`,
          source_references: {
            transaction_id: transaction.id,
            ...(transaction.subcategory_id ? { subcategory_id: transaction.subcategory_id } : {}),
            ...(usualSpendingPercent === null || usualSpending === null ? {} : {
              usual_spending_percent: usualSpendingPercent.toFixed(2),
              usual_spending_centavos: String(Math.round(usualSpending * 100)),
            }),
          },
          anomaly_score: anomalous && typeof decision.severity === "number" && Number.isFinite(decision.severity) ? decision.severity : null,
        }];
      });
    } catch {
      return [unavailableFinding(input.report_date, "Anomaly detection is temporarily unavailable.")];
    } finally {
      clearTimeout(timeout);
    }
  }
}
