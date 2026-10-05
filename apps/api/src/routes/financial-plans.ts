import { Router, type Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { FinancialPlanInputError, FinancialPlanUnavailableError, getFinancialPlanRecommendation } from "../services/financialPlan/recommendationService.js";
import { FinancialPlanMlError } from "../services/financialPlan/mlAdapter.js";

const router = Router();

router.post("/recommendation", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  try {
    const { includedSubcategoryIds, includedCategoryIds, plannedAmountCentavos, manualAllocations, skipDebtRepayments, skipSavingsContributions } = parseRecommendationInput(request.body);
    response.status(200).json({ payload: await getFinancialPlanRecommendation(request.userId!, request.supabase!, plannedAmountCentavos, includedSubcategoryIds, includedCategoryIds, manualAllocations, { skipDebtRepayments, skipSavingsContributions }) });
  } catch (error) {
    const status = error instanceof FinancialPlanInputError ? 422 : error instanceof FinancialPlanMlError || error instanceof FinancialPlanUnavailableError ? 503 : 500;
    console.error("financial plan recommendation failed", { user_id: request.userId, request_id: request.header("x-request-id")?.slice(0, 128) ?? null, status, error_class: error instanceof Error ? error.constructor.name : "UnknownError" });
    response.status(status).json({ error: status === 422 ? "Unprocessable Entity" : status === 500 ? "Internal Server Error" : "Service Unavailable", message: status === 422 ? "Financial Plan inputs are incomplete" : "Financial Plan is temporarily unavailable" });
  }
});

type ManualAllocation = { target: "category" | "subcategory"; id: string; amountCentavos: number };

function parseRecommendationInput(value: unknown): { includedSubcategoryIds: string[]; includedCategoryIds: string[]; plannedAmountCentavos: number; manualAllocations: ManualAllocation[]; skipDebtRepayments: boolean; skipSavingsContributions: boolean } {
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
  const rawManualAllocations = (value as Record<string, unknown>).manualAllocations;
  if (rawManualAllocations !== undefined && (!Array.isArray(rawManualAllocations) || rawManualAllocations.length > 200)) throw new FinancialPlanInputError("Manual category allocations are invalid");
  const manualAllocations = (rawManualAllocations ?? []).map((allocation): ManualAllocation => {
    if (!allocation || typeof allocation !== "object" || Array.isArray(allocation)) throw new FinancialPlanInputError("Manual category allocations are invalid");
    const record = allocation as Record<string, unknown>;
    if ((record.target !== "category" && record.target !== "subcategory") || typeof record.id !== "string" || !record.id.trim() || record.id.length > 128 || typeof record.amountCentavos !== "number" || !Number.isSafeInteger(record.amountCentavos) || record.amountCentavos <= 0 || record.amountCentavos > plannedAmountCentavos) throw new FinancialPlanInputError("Manual category allocations are invalid");
    return { target: record.target, id: record.id.trim(), amountCentavos: record.amountCentavos };
  });
  if (new Set(manualAllocations.map((allocation) => `${allocation.target}:${allocation.id}`)).size !== manualAllocations.length) throw new FinancialPlanInputError("Manual category allocations are invalid");
  const parseSkip = (key: "skipDebtRepayments" | "skipSavingsContributions") => {
    const skip = (value as Record<string, unknown>)[key];
    if (skip !== undefined && typeof skip !== "boolean") throw new FinancialPlanInputError("Reservation skips are invalid");
    return skip ?? false;
  };
  return { includedSubcategoryIds, includedCategoryIds, plannedAmountCentavos, manualAllocations, skipDebtRepayments: parseSkip("skipDebtRepayments"), skipSavingsContributions: parseSkip("skipSavingsContributions") };
}

export default router;
