import type { PlanSpendingReview } from "../../features/financial-plan/pastPlanTypes";

export async function getPlanSpendingReview(_userId: string, _planId: string): Promise<PlanSpendingReview | null> {
  throw new Error("getPlanSpendingReview is not implemented");
}
