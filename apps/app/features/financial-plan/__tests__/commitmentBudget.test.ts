import { parseBudgetAmount, updateCommitmentBudget } from "../helpers/commitmentBudget";
import type { FinancialPlanRecommendation } from "../types";

function infeasiblePlan(): FinancialPlanRecommendation {
  return {
    status: "INFEASIBLE", period: { start: "2026-10-01", end: "2026-10-31" }, explanations: [],
    inputSnapshot: { plannedAmountCentavos: 100_000, forecast: {}, restrictions: {}, obligations: {}, debtRequirements: { reservations: [{ debtAccountId: "loan", dueDate: "2026-10-20", amountCentavos: 50_000 }] }, savingsRequirements: {}, classification: {} },
    recommendation: { availableFundsCentavos: 50_000, requiredFundsCentavos: 125_000, shortfallCentavos: 25_000, allocations: [{ categoryId: "rent", allocationRule: "MINIMUM", floorAmountCentavos: 75_000, allocatedAmountCentavos: 75_000 }], debtReservations: [{ debtAccountId: "loan", dueDate: "2026-10-20", amountCentavos: 50_000 }], savingsReservations: [] },
  };
}

it("makes an infeasible plan feasible by reducing its debt budget while retaining the amount due", () => {
  const result = updateCommitmentBudget(infeasiblePlan(), "debtReservations", 0, 25_000);
  expect(result.status).toBe("RECOMMENDATION_READY");
  expect(result.recommendation).toMatchObject({ availableFundsCentavos: 75_000, requiredFundsCentavos: 100_000, shortfallCentavos: 0 });
  expect(result.inputSnapshot.debtRequirements.reservations).toEqual([{ debtAccountId: "loan", dueDate: "2026-10-20", amountCentavos: 50_000 }]);
  const increased = updateCommitmentBudget(result, "debtReservations", 0, 60_000);
  expect(increased.status).toBe("INFEASIBLE");
  expect(increased.recommendation.availableFundsCentavos).toBe(40_000);
});

it.each(["", "-1", "1.234", "1e5", "Infinity", "0x10", "1000000001"])("rejects an invalid budget %s", (value) => {
  expect(parseBudgetAmount(value)).toBeNull();
});

it("accepts zero and decimal drafts", () => {
  expect(parseBudgetAmount("0")).toBe(0);
  expect(parseBudgetAmount("75.")).toBe(7_500);
  expect(parseBudgetAmount("75.25")).toBe(7_525);
});
