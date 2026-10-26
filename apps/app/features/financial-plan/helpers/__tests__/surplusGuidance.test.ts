import { surplusGuidanceMessage } from "../surplusGuidance";
import type { FinancialPlanSurplusRecommendation } from "../../types";

const guidance = (overrides: Partial<FinancialPlanSurplusRecommendation>): FinancialPlanSurplusRecommendation => ({
  unallocatedSurplusCentavos: 500_000,
  reasonCode: "USER_DIRECTED",
  assessmentStatus: "applied",
  advisoryDestination: null,
  assessmentEvidence: null,
  ...overrides,
});
const values = { monthsCovered: 1.25, debtShare: 0.42, margin: -3_000 };

describe("surplusGuidanceMessage", () => {
  it("uses the profile's words and readable values for each signal", () => {
    expect(surplusGuidanceMessage(guidance({ reasonCode: "DEBT_SIGNAL", advisoryDestination: { type: "debt", debtAccountId: "debt-1", label: "Car loan" } }), values))
      .toBe("Debt burden is too high: payments use 42% of your monthly income. We suggest putting it toward Car loan.");
    expect(surplusGuidanceMessage(guidance({ reasonCode: "EMERGENCY_FUND_INADEQUATE", advisoryDestination: { type: "emergency_fund", savingsGoalId: "goal-1" } }), values))
      .toBe("Your emergency fund needs building: it covers about 1.3 months of expenses. We suggest putting it toward your emergency fund.");
    expect(surplusGuidanceMessage(guidance({ reasonCode: "CREDIT_CARD_SIGNAL", advisoryDestination: { type: "credit_card", accountId: "card-1", label: "Visa" } }), values))
      .toBe("Your credit card keeps a balance, so paying extra cuts the interest. We suggest putting it toward Visa.");
  });

  it("explains a reward and a tight month", () => {
    expect(surplusGuidanceMessage(guidance({ reasonCode: "REWARD_YOURSELF" }), { ...values, margin: 8_000 })).toContain("money left over (PHP 8,000 a month)");
    expect(surplusGuidanceMessage(guidance({ reasonCode: "NEGATIVE_FINANCIAL_MARGIN" }), values)).toBe("Your monthly budget is falling short by PHP 3,000. We suggest keeping this money aside for now.");
  });

  it("leaves the choice to the user when the profile can't guide it", () => {
    expect(surplusGuidanceMessage(guidance({ reasonCode: "ASSESSMENT_STALE", assessmentStatus: "stale" }), values)).toContain("changed since it was last checked");
    expect(surplusGuidanceMessage(guidance({ reasonCode: "ASSESSMENT_INSUFFICIENT_DATA", assessmentStatus: "insufficient_data" }), values)).toContain("not enough data yet");
    expect(surplusGuidanceMessage(undefined, values)).toBe("Choose how to use this money.");
  });
});
