jest.mock("../../lib/mlClient.js", () => ({ classifyFinancialCondition: jest.fn() }));

import { classifyFinancialCondition } from "../../lib/mlClient.js";
import { createOnboardingFinancialConditionAssessment } from "../../services/financialConditionAssessmentService.js";

const mockClassify = classifyFinancialCondition as jest.Mock;

const answers = {
  monthly_income: "50000",
  monthly_essential_living_costs: "30000",
  liquid_emergency_savings: "20000",
  paying_off_debt: "false",
};

async function submittedInput(cardAnswers: Record<string, string>) {
  mockClassify.mockResolvedValue({ ok: false, reason: "not_configured" });
  await createOnboardingFinancialConditionAssessment("user-1", { ...answers, ...cardAnswers }, {} as never);
  return mockClassify.mock.calls[0]![1] as Record<string, unknown>;
}

describe("onboarding financial condition assessment", () => {
  it.each([
    [{ credit_card_payment_behavior: "never" }, 0],
    [{ credit_card_payment_behavior: "every_month" }, 12],
    [{ credit_card_payment_behavior: "some_months", credit_card_revolving_months: "4" }, 4],
    [{ credit_card_payment_behavior: "not_sure", credit_card_revolving_months: "0" }, 0],
    [{ credit_card_payment_behavior: "no_credit_card", credit_card_revolving_months: "4" }, null],
    [{ credit_card_payment_behavior: "some_months" }, null],
  ])("sends the self-reported revolving months for %j", async (cardAnswers, expected) => {
    const input = await submittedInput(cardAnswers);
    expect(input.self_reported_revolving_months).toBe(expected);
    expect(input.self_reported_credit_card_behavior).toBe(cardAnswers.credit_card_payment_behavior);
  });
});
