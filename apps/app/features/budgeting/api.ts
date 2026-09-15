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
  if (payload.forecastHorizon !== "MONTHLY" || payload.forecastLevel !== "CATEGORY_GROUP" || (payload.status !== "SUCCESS" && payload.status !== "FALLBACK") || !Array.isArray(payload.forecasts) || payload.forecasts.some((point) => !isBudgetForecastDate(point.date) || !Number.isSafeInteger(point.amountCentavos) || point.amountCentavos < 0 || (point.category !== null && (typeof point.category !== "string" || !point.category.trim() || point.category.length > 160)))) return null;
  const interval = payload.confidenceInterval;
  if (!interval || Object.values(interval).some((amount) => !Number.isSafeInteger(amount) || amount < 0)) return null;
  return {
    version: 1,
    forecasts: payload.forecasts.map((point) => ({ date: point.date, amountMinor: point.amountCentavos, category: point.category })),
    forecastHorizon: "MONTHLY",
    forecastLevel: "CATEGORY_GROUP",
    confidenceInterval: { lower80Minor: interval.lower80Centavos, upper80Minor: interval.upper80Centavos, lower95Minor: interval.lower95Centavos, upper95Minor: interval.upper95Centavos },
    status: payload.status,
  };
}

function isBudgetForecastDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
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
