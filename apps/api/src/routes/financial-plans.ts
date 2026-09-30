import { Router, type Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { FinancialPlanInputError, FinancialPlanUnavailableError, getFinancialPlanRecommendation } from "../services/financialPlan/recommendationService.js";
import { FinancialPlanMlError } from "../services/financialPlan/mlAdapter.js";

const router = Router();

router.post("/recommendation", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  try {
    const includedSubcategoryIds = parseIncludedSubcategoryIds(request.body);
    response.status(200).json({ payload: await getFinancialPlanRecommendation(request.userId!, request.supabase!, includedSubcategoryIds) });
  } catch (error) {
    const status = error instanceof FinancialPlanInputError ? 422 : error instanceof FinancialPlanMlError || error instanceof FinancialPlanUnavailableError ? 503 : 500;
    console.error("financial plan recommendation failed", { user_id: request.userId, request_id: request.header("x-request-id")?.slice(0, 128) ?? null, status, error_class: error instanceof Error ? error.constructor.name : "UnknownError" });
    response.status(status).json({ error: status === 422 ? "Unprocessable Entity" : status === 500 ? "Internal Server Error" : "Service Unavailable", message: status === 422 ? "Financial Plan inputs are incomplete" : "Financial Plan is temporarily unavailable" });
  }
});

function parseIncludedSubcategoryIds(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const ids = (value as Record<string, unknown>).includedSubcategoryIds;
  if (ids === undefined) return [];
  if (!Array.isArray(ids) || ids.length > 200 || ids.some((id) => typeof id !== "string" || !id.trim() || id.length > 128)) {
    throw new FinancialPlanInputError("Included subcategories are invalid");
  }
  return [...new Set(ids.map((id) => id.trim()))];
}

export default router;
