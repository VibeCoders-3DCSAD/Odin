import { Router, type Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { FinancialPlanInputError, FinancialPlanUnavailableError, getFinancialPlanRecommendation } from "../services/financialPlan/recommendationService.js";
import { FinancialPlanMlError } from "../services/financialPlan/mlAdapter.js";

const router = Router();

router.post("/recommendation", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  try {
    response.status(200).json({ payload: await getFinancialPlanRecommendation(request.userId!, request.supabase!) });
  } catch (error) {
    const status = error instanceof FinancialPlanInputError ? 422 : error instanceof FinancialPlanMlError || error instanceof FinancialPlanUnavailableError ? 503 : 500;
    console.error("financial plan recommendation failed", { user_id: request.userId, request_id: request.header("x-request-id")?.slice(0, 128) ?? null, status, error_class: error instanceof Error ? error.constructor.name : "UnknownError" });
    response.status(status).json({ error: status === 422 ? "Unprocessable Entity" : status === 500 ? "Internal Server Error" : "Service Unavailable", message: status === 422 ? "Financial Plan inputs are incomplete" : "Financial Plan is temporarily unavailable" });
  }
});

export default router;
