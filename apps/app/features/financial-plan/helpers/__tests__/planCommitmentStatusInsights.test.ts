import { planCommitmentStatusInsights } from "../planCommitmentStatusInsights";
import type { FinancialPlanRecommendation } from "../../types";

function plan(): FinancialPlanRecommendation {
  return {
    status: "RECOMMENDATION_READY", period: { start: "2026-10-01", end: "2026-10-31" }, explanations: [],
    inputSnapshot: { plannedAmountCentavos: 100_000, forecast: {}, restrictions: {}, classification: {}, debtRequirements: {}, savingsRequirements: {}, obligations: {} },
    recommendation: { availableFundsCentavos: 100_000, allocations: [], debtReservations: [], savingsReservations: [] },
  };
}

describe("plan commitment status insights", () => {
  it("summarizes due debt repayments, including partially funded commitments", () => {
    const value = plan();
    value.recommendation.debtReservations = ["paid", "partial", "unpaid"].map((debtAccountId) => ({ debtAccountId, amountCentavos: 1_000 }));
    value.inputSnapshot.debtRequirements = { reservations: [{ debtAccountId: "partial", amountCentavos: 2_000 }] };
    expect(planCommitmentStatusInsights(value, { paidCentavos: { "debt:paid": 1_000, "debt:partial": 1_000 }, settledKeys: [] }))
      .toEqual(["Debt repayments: 1 paid · 1 partial · 1 unpaid."]);
  });

  it("counts savings contributions once as done, partial or pending across repeated due dates", () => {
    const value = plan();
    value.recommendation.savingsReservations = ["2026-10-30", "2026-10-02", "2026-10-16"].map((dueDate) => ({ savingsGoalId: "emergency", amountCentavos: 1_000, dueDate }));
    expect(planCommitmentStatusInsights(value, { paidCentavos: { "savings:emergency": 1_400 }, settledKeys: [] }))
      .toEqual(["Savings contributions: 1 done · 1 partial · 1 pending."]);
  });

  it("recognizes settled billers and summarizes unpaid and partial remittances", () => {
    const value = plan();
    value.inputSnapshot.obligations = { reservations: ["2026-10-05", "2026-10-19", "2026-10-26"].map((dueDate) => ({ scheduledPaymentId: "bill", amountCentavos: 1_000, dueDate })) };
    expect(planCommitmentStatusInsights(value, { paidCentavos: { "scheduled:bill:2026-10-05": 800, "scheduled:bill:2026-10-19": 500 }, settledKeys: ["scheduled:bill:2026-10-05"] }))
      .toEqual(["Billers & remittances: 1 paid · 1 partial · 1 unpaid."]);
  });

  it("omits empty, zero-due and excluded groups", () => {
    const value = plan();
    value.inputSnapshot.commitmentSelection = { debtRepayments: false, savingsContributions: true, scheduledPayments: false };
    value.recommendation.debtReservations = [{ debtAccountId: "loan", amountCentavos: 1_000 }];
    value.recommendation.savingsReservations = [{ savingsGoalId: "goal", amountCentavos: 0 }];
    value.inputSnapshot.obligations = { reservations: [{ scheduledPaymentId: "bill", amountCentavos: 1_000 }] };
    expect(planCommitmentStatusInsights(value, { paidCentavos: {}, settledKeys: [] })).toEqual([]);
    expect(planCommitmentStatusInsights(plan(), null)).toEqual([]);
  });

  it("does not report unreadable payments as unpaid", () => {
    const value = plan();
    value.recommendation.debtReservations = [{ debtAccountId: "loan", amountCentavos: 1_000 }];
    expect(planCommitmentStatusInsights(value, null)).toEqual(["Debt repayments: status unavailable."]);
  });
});
