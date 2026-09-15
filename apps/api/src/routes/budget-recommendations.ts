import { Router, type Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { BudgetRecommendationUpstreamError, BudgetRecommendationValidationError, getBudgetRecommendation, parseBudgetRecommendationRequest } from "../services/budgetRecommendationService.js";

const router = Router();

router.post("/", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  try {
    const recommendation = await getBudgetRecommendation(request.userId!, parseBudgetRecommendationRequest(request.body), request.supabase!);
    response.status(200).json({ payload: recommendation });
  } catch (error) {
    if (error instanceof BudgetRecommendationValidationError) {
      response.status(400).json({ error: "Bad Request", message: "Invalid budget recommendation request" });
      return;
    }
    const status = error instanceof BudgetRecommendationUpstreamError ? error.status : 503;
    console.error("Budget recommendation request failed", { user_id: request.userId, request_id: request.header("x-request-id")?.slice(0, 128) ?? null, category_count: Array.isArray(request.body?.allocations) ? request.body.allocations.length : 0, upstream_status: status, error_class: error instanceof Error ? error.constructor.name : "UnknownError" });
    response.status(status === 422 ? 422 : 503).json({ error: status === 422 ? "Unprocessable Entity" : "Service Unavailable", message: status === 422 ? "Budget optimizer could not satisfy this request" : "Budget optimizer is temporarily unavailable" });
  }
});

export default router;
