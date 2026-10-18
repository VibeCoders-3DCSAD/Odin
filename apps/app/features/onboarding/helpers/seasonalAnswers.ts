import { STEPS, type StepConfig } from "../types";

export function availableOnboardingStep(step: StepConfig, answers: Record<string, unknown>): StepConfig {
  if (step.questionKey !== "low_expense_seasons") return step;
  const higher = Array.isArray(answers.high_expense_seasons) ? answers.high_expense_seasons : [];
  return { ...step, options: step.options?.filter(({ key }) => key === "none" || !higher.includes(key)) };
}

export function withOnboardingAnswer(answers: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  const next = { ...answers, [key]: value };
  if (key !== "high_expense_seasons" && key !== "low_expense_seasons") return next;
  const higher = Array.isArray(next.high_expense_seasons) ? next.high_expense_seasons : [];
  if (Array.isArray(next.low_expense_seasons)) {
    next.low_expense_seasons = next.low_expense_seasons.filter((season) => season === "none" || !higher.includes(season));
  }
  return next;
}

// Old drafts use holiday/weather choices that do not identify a calendar quarter.
// Ask for those preferences again rather than guessing a new answer.
export function currentSeasonalAnswers(answers: Record<string, unknown>): Record<string, unknown> {
  const next = { ...answers };
  for (const key of ["high_expense_seasons", "low_expense_seasons", "saving_seasons"]) {
    const value = next[key];
    const options = STEPS.find((step) => step.questionKey === key)?.options ?? [];
    if (Array.isArray(value)) next[key] = value.filter((selection) => options.some((option) => option.key === selection));
  }
  return next;
}
