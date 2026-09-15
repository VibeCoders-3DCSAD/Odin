import { listForecastTransactions } from "../../local-db/repositories/forecastTransactions";
import { requestForecast } from "../forecast/api";
import { toBudgetRecommendationForecast, type BudgetRecommendationHistoricalTransaction } from "./api";
import { BUDGET_RECOMMENDATION_CONFIG } from "./config";

type LoadBudgetRecommendationContextOptions = {
  userId: string;
  accessToken: string;
  signal?: AbortSignal;
};

export async function loadBudgetRecommendationContext({ userId, accessToken, signal }: LoadBudgetRecommendationContextOptions) {
  const historicalTransactions: BudgetRecommendationHistoricalTransaction[] = (await listForecastTransactions(userId, { fromDate: getHistoryStartDate() })).map(({ transactionId, date, amount, category, transactionType }) => ({ transactionId, date, amount, category, transactionType }));
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  if (historicalTransactions.length === 0) return { historicalTransactions };

  try {
    const result = await requestForecast(accessToken, {
      historicalTransactions,
      forecastHorizon: "MONTHLY",
      forecastLevel: "CATEGORY_GROUP",
    }, signal);
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    const forecast = result.response.ok && result.body.payload
      ? toBudgetRecommendationForecast(result.body.payload)
      : null;
    return forecast ? { historicalTransactions, forecast } : { historicalTransactions };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { historicalTransactions };
  }
}

function getHistoryStartDate(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() - BUDGET_RECOMMENDATION_CONFIG.historyMonths;
  const daysInTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const start = new Date(Date.UTC(year, month, Math.min(now.getUTCDate(), daysInTargetMonth)));
  return start.toISOString().slice(0, 10);
}
