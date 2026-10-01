import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type { FinancialPlanRecommendation } from "./types";

export async function requestFinancialPlanRecommendation(accessToken: string, includedSubcategoryIds: string[], includedCategoryIds: string[], plannedAmountCentavos: number, signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(`${API_BASE_URL}/odin/api/financial-plans/recommendation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ includedSubcategoryIds, includedCategoryIds, plannedAmountCentavos }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({})) as { payload?: FinancialPlanRecommendation; message?: string };
    return { response, body };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
