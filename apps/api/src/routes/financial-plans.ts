import { Router, type Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { FinancialPlanInputError, FinancialPlanUnavailableError, getFinancialPlanRecommendation } from "../services/financialPlan/recommendationService.js";
import { FinancialPlanMlError } from "../services/financialPlan/mlAdapter.js";

const router = Router();

router.post("/recommendation", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  try {
    const { includedSubcategoryIds, includedCategoryIds, plannedAmountCentavos } = parseRecommendationInput(request.body);
    response.status(200).json({ payload: await getFinancialPlanRecommendation(request.userId!, request.supabase!, plannedAmountCentavos, includedSubcategoryIds, includedCategoryIds) });
  } catch (error) {
    const status = error instanceof FinancialPlanInputError ? 422 : error instanceof FinancialPlanMlError || error instanceof FinancialPlanUnavailableError ? 503 : 500;
    console.error("financial plan recommendation failed", { user_id: request.userId, request_id: request.header("x-request-id")?.slice(0, 128) ?? null, status, error_class: error instanceof Error ? error.constructor.name : "UnknownError" });
    response.status(status).json({ error: status === 422 ? "Unprocessable Entity" : status === 500 ? "Internal Server Error" : "Service Unavailable", message: status === 422 ? "Financial Plan inputs are incomplete" : "Financial Plan is temporarily unavailable" });
  }
});

function parseRecommendationInput(value: unknown): { includedSubcategoryIds: string[]; includedCategoryIds: string[]; plannedAmountCentavos: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FinancialPlanInputError("Planning amount is invalid");
  const parse = (key: "includedSubcategoryIds" | "includedCategoryIds") => {
    const ids = (value as Record<string, unknown>)[key];
    if (ids === undefined) return [];
    if (!Array.isArray(ids) || ids.length > 200 || ids.some((id) => typeof id !== "string" || !id.trim() || id.length > 128)) throw new FinancialPlanInputError("Included categories are invalid");
    return [...new Set(ids.map((id) => id.trim()))];
  };
  const includedSubcategoryIds = parse("includedSubcategoryIds");
  const includedCategoryIds = parse("includedCategoryIds");
  if (includedSubcategoryIds.length + includedCategoryIds.length > 200) {
    throw new FinancialPlanInputError("Included subcategories are invalid");
  }
  const plannedAmountCentavos = (value as Record<string, unknown>).plannedAmountCentavos;
  if (typeof plannedAmountCentavos !== "number" || !Number.isSafeInteger(plannedAmountCentavos) || plannedAmountCentavos <= 0 || plannedAmountCentavos > 100_000_000_000) throw new FinancialPlanInputError("Planning amount is invalid");
  return { includedSubcategoryIds, includedCategoryIds, plannedAmountCentavos };
}

export default router;
