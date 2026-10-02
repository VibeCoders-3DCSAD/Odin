import { deriveSurplusRecommendation } from "../../../services/financialPlan/classificationPolicy.js";

const assessment = (overrides: Record<string, unknown> = {}) => ({
  id: "assessment-1",
  assessedAt: "2026-10-01T10:00:00.000Z",
  ruleSetVersion: "financial_rules_v1",
  outputSnapshot: {
    emergency_savings: { status: "SUCCESS", label: "EMERGENCY_FUND_ADEQUATE" },
    debt_burden: { status: "SUCCESS", label: "NOT_FINANCIALLY_OVERBURDENED" },
    financial_margin: { status: "SUCCESS", label: "POSITIVE_FINANCIAL_MARGIN" },
    ...overrides,
  },
});

describe("deriveSurplusRecommendation", () => {
  it("holds optional surplus for review when the financial margin is negative", () => {
    expect(deriveSurplusRecommendation({ unallocatedSurplusCentavos: 10_000, assessment: assessment({ financial_margin: { status: "SUCCESS", label: "NEGATIVE_FINANCIAL_MARGIN" } }), sourceUpdatedAt: null, eligibleEmergencyGoalId: "goal-1", eligibleDebtId: "debt-1" })).toMatchObject({ reasonCode: "NEGATIVE_FINANCIAL_MARGIN", advisoryDestination: null });
  });

  it("recommends only a verified emergency goal", () => {
    expect(deriveSurplusRecommendation({ unallocatedSurplusCentavos: 10_000, assessment: assessment({ emergency_savings: { status: "SUCCESS", label: "EMERGENCY_FUND_INADEQUATE" } }), sourceUpdatedAt: null, eligibleEmergencyGoalId: "goal-1", eligibleDebtId: "debt-1" })).toMatchObject({ reasonCode: "EMERGENCY_FUND_INADEQUATE", advisoryDestination: { type: "emergency_fund", savingsGoalId: "goal-1" } });
  });

  it("uses a debt signal only when an eligible debt exists", () => {
    const input = { unallocatedSurplusCentavos: 10_000, assessment: assessment({ debt_burden: { status: "SUCCESS", label: "FINANCIALLY_OVERBURDENED" } }), sourceUpdatedAt: null, eligibleEmergencyGoalId: null };
    expect(deriveSurplusRecommendation({ ...input, eligibleDebtId: "debt-1" }).advisoryDestination).toEqual({ type: "debt", debtAccountId: "debt-1" });
    expect(deriveSurplusRecommendation({ ...input, eligibleDebtId: null }).reasonCode).toBe("USER_DIRECTED");
  });

  it("keeps the surplus user-directed for stale or insufficient assessments", () => {
    expect(deriveSurplusRecommendation({ unallocatedSurplusCentavos: 10_000, assessment: assessment(), sourceUpdatedAt: "2026-10-01T10:00:01.000Z", eligibleEmergencyGoalId: null, eligibleDebtId: null }).reasonCode).toBe("ASSESSMENT_STALE");
    expect(deriveSurplusRecommendation({ unallocatedSurplusCentavos: 10_000, assessment: assessment({ emergency_savings: { status: "INSUFFICIENT_DATA" } }), sourceUpdatedAt: null, eligibleEmergencyGoalId: null, eligibleDebtId: null }).reasonCode).toBe("ASSESSMENT_INSUFFICIENT_DATA");
  });
});
