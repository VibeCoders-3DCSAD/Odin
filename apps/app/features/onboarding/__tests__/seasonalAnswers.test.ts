import { STEPS } from "../types";
import { availableOnboardingStep, currentSeasonalAnswers, withOnboardingAnswer } from "../helpers/seasonalAnswers";

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

it("preserves named seasons and asks again for retired quarter choices", () => {
  expect(currentSeasonalAnswers({ high_expense_seasons: ["christmas_ber_months"], low_expense_seasons: ["summer", "q2"], saving_seasons: ["none"], monthly_income: "50000" }))
    .toEqual({ questionnaire_version: "2", high_expense_seasons: ["christmas_ber_months"], low_expense_seasons: ["summer"], saving_seasons: ["none"], monthly_income: "50000" });
});

it("keeps custom events when resuming and excludes their conflicting expense choice", () => {
  const custom = { id: "custom_tuition", name: "Tuition payment", months: [1, 8] };
  const answers = { custom_seasonal_events: [custom], high_expense_seasons: [custom.id], low_expense_seasons: ["summer"], saving_seasons: [custom.id] };
  expect(currentSeasonalAnswers(answers)).toEqual({ ...answers, questionnaire_version: "2" });
  const saving = STEPS.find((step) => step.questionKey === "saving_seasons")!;
  expect(availableOnboardingStep(saving, answers).options).toContainEqual({ key: custom.id, label: custom.name, description: "January, August" });
  expect(availableOnboardingStep(lowerStep, answers).options?.some((option) => option.key === custom.id)).toBe(false);
});
