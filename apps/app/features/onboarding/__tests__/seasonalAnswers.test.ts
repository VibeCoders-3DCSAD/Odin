import { STEPS } from "../types";
import { availableOnboardingStep, currentSeasonalAnswers, withOnboardingAnswer } from "../helpers/seasonalAnswers";

const lowerStep = STEPS.find((step) => step.questionKey === "low_expense_seasons")!;

describe("seasonal onboarding answers", () => {
  it("asks about lower expenses immediately after higher expenses", () => {
    const index = STEPS.findIndex((step) => step.questionKey === "high_expense_seasons");
    expect(STEPS[index + 1]).toBe(lowerStep);
  });

  it("excludes higher seasons from lower choices and keeps none available", () => {
    const step = availableOnboardingStep(lowerStep, { high_expense_seasons: ["q2", "q4"] });
    expect(step.options?.map(({ key }) => key)).toEqual(expect.arrayContaining(["q3", "none"]));
    expect(step.options?.map(({ key }) => key)).not.toEqual(expect.arrayContaining(["q2"]));
    expect(step.options?.map(({ key }) => key)).not.toEqual(expect.arrayContaining(["q4"]));
  });

  it("clears conflicting lower answers when going back to change higher seasons", () => {
    const answers = { high_expense_seasons: ["q2"], low_expense_seasons: ["q3", "q4"], saving_seasons: ["q3"] };
    expect(withOnboardingAnswer(answers, "high_expense_seasons", ["q2", "q3"])).toEqual({
      ...answers, high_expense_seasons: ["q2", "q3"], low_expense_seasons: ["q4"],
    });
    expect(answers.low_expense_seasons).toEqual(["q3", "q4"]);
  });

  it("leaves an empty answer requiring reselection if all lower choices become higher", () => {
    expect(withOnboardingAnswer({ low_expense_seasons: ["q2"] }, "high_expense_seasons", ["q2"])).toMatchObject({ low_expense_seasons: [] });
  });

  it("allows no pattern for both directions and preserves saving preferences", () => {
    const answers = { low_expense_seasons: ["none"], saving_seasons: ["q2"] };
    expect(withOnboardingAnswer(answers, "high_expense_seasons", ["none"])).toMatchObject(answers);
    expect(availableOnboardingStep(lowerStep, { high_expense_seasons: ["none"] }).options).toEqual(lowerStep.options);
  });
});

it("requires new calendar-period answers when resuming legacy seasonal preferences", () => {
  expect(currentSeasonalAnswers({ high_expense_seasons: ["christmas_ber_months"], low_expense_seasons: ["summer"], saving_seasons: ["none"], monthly_income: "50000" }))
    .toEqual({ high_expense_seasons: [], low_expense_seasons: [], saving_seasons: ["none"], monthly_income: "50000" });
});
