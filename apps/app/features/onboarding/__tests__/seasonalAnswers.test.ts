import { STEPS } from "../types";
import { availableOnboardingStep, withOnboardingAnswer } from "../helpers/seasonalAnswers";

const lowerStep = STEPS.find((step) => step.questionKey === "low_expense_seasons")!;

describe("seasonal onboarding answers", () => {
  it("asks about lower expenses immediately after higher expenses", () => {
    const index = STEPS.findIndex((step) => step.questionKey === "high_expense_seasons");
    expect(STEPS[index + 1]).toBe(lowerStep);
  });

  it("excludes higher seasons from lower choices and keeps none available", () => {
    const step = availableOnboardingStep(lowerStep, { high_expense_seasons: ["summer", "christmas_ber_months"] });
    expect(step.options?.map(({ key }) => key)).toEqual(expect.arrayContaining(["rainy_season", "none"]));
    expect(step.options?.map(({ key }) => key)).not.toEqual(expect.arrayContaining(["summer"]));
    expect(step.options?.map(({ key }) => key)).not.toEqual(expect.arrayContaining(["christmas_ber_months"]));
  });

  it("clears conflicting lower answers when going back to change higher seasons", () => {
    const answers = { high_expense_seasons: ["summer"], low_expense_seasons: ["rainy_season", "christmas_ber_months"], saving_seasons: ["rainy_season"] };
    expect(withOnboardingAnswer(answers, "high_expense_seasons", ["summer", "rainy_season"])).toEqual({
      ...answers, high_expense_seasons: ["summer", "rainy_season"], low_expense_seasons: ["christmas_ber_months"],
    });
    expect(answers.low_expense_seasons).toEqual(["rainy_season", "christmas_ber_months"]);
  });

  it("leaves an empty answer requiring reselection if all lower choices become higher", () => {
    expect(withOnboardingAnswer({ low_expense_seasons: ["summer"] }, "high_expense_seasons", ["summer"])).toMatchObject({ low_expense_seasons: [] });
  });

  it("allows no pattern for both directions and preserves saving preferences", () => {
    const answers = { low_expense_seasons: ["none"], saving_seasons: ["summer"] };
    expect(withOnboardingAnswer(answers, "high_expense_seasons", ["none"])).toMatchObject(answers);
    expect(availableOnboardingStep(lowerStep, { high_expense_seasons: ["none"] }).options).toEqual(lowerStep.options);
  });
});
