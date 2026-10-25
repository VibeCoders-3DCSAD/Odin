import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import { authorizedFetch } from "../../lib/localAccess";
import type { FinancialPlanRecommendation } from "./types";
import type { CommitmentBudget, CommitmentPreview } from "./helpers/commitmentBudget";

// The server chains the forecast (8s), the budget optimizer (8s) and the explanation (5s) upstream calls,
// so the shared 10s request timeout cut off plans that were still on track to succeed.
const RECOMMENDATION_TIMEOUT_MS = 30_000;

export type ManualPlanAllocation = { target: "category" | "subcategory"; id: string; amountCentavos: number };
export type ReservationSkips = { debtRepayments: boolean; savingsContributions: boolean; commitmentBudgets?: CommitmentBudget[] };

export async function requestFinancialPlanCommitments(accessToken: string, planMonth?: string): Promise<CommitmentPreview> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await authorizedFetch(`${API_BASE_URL}/odin/api/financial-plans/commitments`, {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(__DEV__ && planMonth ? { planMonth } : {}), signal: controller.signal,
    });
    if (!response.ok) throw new Error("Your commitments could not be loaded. Try again.");
    const body = await response.json() as { payload: CommitmentPreview };
    return body.payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestFinancialPlanRecommendation(accessToken: string, includedSubcategoryIds: string[], includedCategoryIds: string[], plannedAmountCentavos: number, manualAllocations: ManualPlanAllocation[], reservationSkips: ReservationSkips, signal?: AbortSignal, planMonth?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECOMMENDATION_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await authorizedFetch(`${API_BASE_URL}/odin/api/financial-plans/recommendation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ includedSubcategoryIds, includedCategoryIds, plannedAmountCentavos, manualAllocations, skipDebtRepayments: reservationSkips.debtRepayments, skipSavingsContributions: reservationSkips.savingsContributions, ...(reservationSkips.commitmentBudgets ? { commitmentBudgets: reservationSkips.commitmentBudgets } : {}), ...(__DEV__ && planMonth ? { planMonth } : {}) }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({})) as { payload?: FinancialPlanRecommendation; message?: string };
    return { response, body };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

// The plan arrives with deterministic explanations; this fetches the AI ones afterwards.
// Resolves to null on any failure so the plan keeps the explanations it already shows.
export async function requestFinancialPlanExplanations(accessToken: string, explanationRequest: unknown): Promise<string[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await authorizedFetch(`${API_BASE_URL}/odin/api/financial-plans/explanations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(explanationRequest),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = await response.json() as { payload?: { explanations?: unknown } };
    const explanations = body.payload?.explanations;
    return Array.isArray(explanations) && explanations.every((item) => typeof item === "string") ? explanations : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
