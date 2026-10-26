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

const base = { unallocatedSurplusCentavos: 10_000, sourceUpdatedAt: null, eligibleEmergencyGoalId: "goal-1", eligibleDebtId: "debt-1", eligibleCardIds: ["card-1"] };
const overburdened = { debt_burden: { status: "SUCCESS", label: "FINANCIALLY_OVERBURDENED" } };
const inadequate = { emergency_savings: { status: "SUCCESS", label: "EMERGENCY_FUND_INADEQUATE" } };
const revolving = { credit_card_behavior: [{ status: "SUCCESS", label: "HEAVY_REVOLVER", account_id: "card-1" }] };
const negative = { financial_margin: { status: "SUCCESS", label: "NEGATIVE_FINANCIAL_MARGIN" } };

describe("deriveSurplusRecommendation", () => {
  it("puts debt burden ahead of the emergency fund, credit cards, and margin", () => {
    expect(deriveSurplusRecommendation({ ...base, assessment: assessment({ ...overburdened, ...inadequate, ...revolving, ...negative }) })).toMatchObject({ reasonCode: "DEBT_SIGNAL", advisoryDestination: { type: "debt", debtAccountId: "debt-1" } });
  });

  it("puts the emergency fund ahead of credit cards", () => {
    expect(deriveSurplusRecommendation({ ...base, assessment: assessment({ ...inadequate, ...revolving }) })).toMatchObject({ reasonCode: "EMERGENCY_FUND_INADEQUATE", advisoryDestination: { type: "emergency_fund", savingsGoalId: "goal-1" } });
  });

  it("falls through when a signal has no eligible destination", () => {
    expect(deriveSurplusRecommendation({ ...base, eligibleDebtId: null, assessment: assessment({ ...overburdened, ...inadequate }) }).reasonCode).toBe("EMERGENCY_FUND_INADEQUATE");
    expect(deriveSurplusRecommendation({ ...base, eligibleEmergencyGoalId: null, assessment: assessment(inadequate) }).reasonCode).toBe("REWARD_YOURSELF");
  });

  it("suggests the worst card that allows extra payments", () => {
    const cards = { credit_card_behavior: [{ status: "SUCCESS", label: "REVOLVER", account_id: "card-1" }, { status: "SUCCESS", label: "HEAVY_REVOLVER", account_id: "card-2" }, { status: "SUCCESS", label: "HEAVY_REVOLVER", account_id: "card-3" }] };
    expect(deriveSurplusRecommendation({ ...base, eligibleCardIds: ["card-1", "card-2"], assessment: assessment(cards) })).toMatchObject({ reasonCode: "CREDIT_CARD_SIGNAL", advisoryDestination: { type: "credit_card", accountId: "card-2" } });
  });

  it("skips cards paid in full or not allowing extra payments", () => {
    expect(deriveSurplusRecommendation({ ...base, assessment: assessment({ credit_card_behavior: [{ status: "SUCCESS", label: "TRANSACTOR", account_id: "card-1" }] }) }).reasonCode).toBe("REWARD_YOURSELF");
    expect(deriveSurplusRecommendation({ ...base, eligibleCardIds: [], assessment: assessment(revolving) }).reasonCode).toBe("REWARD_YOURSELF");
  });

  it("points a self-reported card answer at the first eligible card", () => {
    expect(deriveSurplusRecommendation({ ...base, eligibleCardIds: ["card-9"], assessment: assessment({ credit_card_behavior: [{ status: "SUCCESS", account_id: "self_reported", source: "self_reported", reported_duration: "over_a_year" }] }) }).advisoryDestination).toEqual({ type: "credit_card", accountId: "card-9" });
  });

  it("suggests a reward with no destination when the margin is manageable", () => {
    expect(deriveSurplusRecommendation({ ...base, assessment: assessment() })).toMatchObject({ reasonCode: "REWARD_YOURSELF", advisoryDestination: null });
  });

  it("sends a negative margin to debt first, then the emergency fund", () => {
    expect(deriveSurplusRecommendation({ ...base, eligibleCardIds: [], assessment: assessment(negative) }).advisoryDestination).toEqual({ type: "debt", debtAccountId: "debt-1" });
    expect(deriveSurplusRecommendation({ ...base, eligibleDebtId: null, eligibleCardIds: [], assessment: assessment(negative) }).advisoryDestination).toEqual({ type: "emergency_fund", savingsGoalId: "goal-1" });
    expect(deriveSurplusRecommendation({ ...base, eligibleDebtId: null, eligibleCardIds: [], eligibleEmergencyGoalId: null, assessment: assessment(negative) })).toMatchObject({ reasonCode: "NEGATIVE_FINANCIAL_MARGIN", advisoryDestination: null });
  });

  it("does not let a row without data block the other checks", () => {
    expect(deriveSurplusRecommendation({ ...base, eligibleCardIds: [], assessment: assessment({ emergency_savings: { status: "INSUFFICIENT_DATA" }, ...negative }) }).reasonCode).toBe("NEGATIVE_FINANCIAL_MARGIN");
    expect(deriveSurplusRecommendation({ ...base, assessment: assessment({ debt_burden: { status: "INSUFFICIENT_DATA" }, ...inadequate }) }).reasonCode).toBe("EMERGENCY_FUND_INADEQUATE");
  });

  it("stays neutral for stale assessments or when nothing has data", () => {
    expect(deriveSurplusRecommendation({ ...base, assessment: assessment(), sourceUpdatedAt: "2026-10-01T10:00:01.000Z" }).reasonCode).toBe("ASSESSMENT_STALE");
    const empty = { emergency_savings: { status: "INSUFFICIENT_DATA" }, debt_burden: { status: "INSUFFICIENT_DATA" }, financial_margin: { status: "INSUFFICIENT_DATA" } };
    expect(deriveSurplusRecommendation({ ...base, assessment: assessment(empty) })).toMatchObject({ reasonCode: "ASSESSMENT_INSUFFICIENT_DATA", advisoryDestination: null });
    expect(deriveSurplusRecommendation({ ...base, assessment: null }).reasonCode).toBe("ASSESSMENT_UNAVAILABLE");
  });
});
