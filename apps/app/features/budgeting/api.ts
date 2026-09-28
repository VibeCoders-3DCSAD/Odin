import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type { ForecastPayload, ForecastTransaction } from "../forecast/types";

export type BudgetRecommendationHistoricalTransaction = Omit<ForecastTransaction, "description">;

export type BudgetRecommendationForecast = {
  version: 1;
  forecasts: Array<{ date: string; amountMinor: number; category: string | null }>;
  forecastHorizon: "MONTHLY";
  forecastLevel: "CATEGORY_GROUP";
  confidenceInterval: { lower80Minor: number; upper80Minor: number; lower95Minor: number; upper95Minor: number };
  status: "SUCCESS" | "FALLBACK";
};

export type BudgetRecommendationRequest = {
  periodKind: "WEEKLY" | "MONTHLY" | "CUSTOM" | "INCOME_CYCLE";
  periodStart: string;
  periodEnd: string;
  totalAmountMinor: number;
  debtBudgetAmountMinor: number;
  savingsBudgetAmountMinor: number;
  allocations: Array<{ categoryId: string | null; subcategoryId: string | null; preferredAmountMinor: number }>;
  historicalTransactions?: BudgetRecommendationHistoricalTransaction[];
  forecast?: BudgetRecommendationForecast;
};

export function toBudgetRecommendationForecast(payload: ForecastPayload): BudgetRecommendationForecast | null {
  // Quarterly HFCE projections cannot safely be treated as monthly budget inputs.
  void payload;
  return null;
}

export type BudgetRecommendation = {
  availableFundsMinor: number;
  debtBudgetAmountMinor: number;
  savingsBudgetAmountMinor: number;
  allocations: Array<{ categoryId: string | null; subcategoryId: string | null; preferredAmountMinor: number; amountMinor: number }>;
};

export async function requestBudgetRecommendation(accessToken: string, request: BudgetRecommendationRequest, signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(`${API_BASE_URL}/odin/api/budget/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    let body: { payload?: BudgetRecommendation; error?: string; message?: string } = {};
    try { body = await response.json(); } catch {}
    return { response, body };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
