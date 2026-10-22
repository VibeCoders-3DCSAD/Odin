import { STEPS, type StepConfig } from "../types";
import { normalizeCustomEvents, eventMonthLabel } from "@odin/spending-insights/seasons";

export const SEASONAL_QUESTION_KEYS = ["high_expense_seasons", "low_expense_seasons", "saving_seasons"];

export function availableOnboardingStep(step: StepConfig, answers: Record<string, unknown>): StepConfig {
  if (!SEASONAL_QUESTION_KEYS.includes(step.questionKey)) return step;
  const custom = normalizeCustomEvents(answers.custom_seasonal_events).map((event) => ({ key: event.id, label: event.name, description: eventMonthLabel(event.months) }));
  const options = [...(step.options ?? []).filter(({ key }) => key !== "none"), ...custom, ...(step.options ?? []).filter(({ key }) => key === "none")];
  const higher = Array.isArray(answers.high_expense_seasons) ? answers.high_expense_seasons : [];
  return { ...step, options: options.filter(({ key }) => step.questionKey !== "low_expense_seasons" || key === "none" || !higher.includes(key)) };
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

// Preserve named events and valid custom references; ask again for retired quarters.
export function currentSeasonalAnswers(answers: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...answers, questionnaire_version: "2" };
  if (answers.questionnaire_version !== "2" && next.monthly_deductions !== undefined) {
    // Old drafts asked for gross income; ask again for take-home income.
    delete next.monthly_income;
  }
  if (next.credit_card_revolving_months === undefined) {
    const legacyCardAnswers: Record<string, string> = { never: "0", every_month: "12", no_credit_card: "no_credit_card", not_sure: "not_sure" };
    if (typeof next.credit_card_payment_behavior === "string") next.credit_card_revolving_months = legacyCardAnswers[next.credit_card_payment_behavior];
  }
  const cardMonths = next.credit_card_revolving_months;
  if (cardMonths === "0") next.credit_card_revolving_months = "always_before_due";
  else if (typeof cardMonths === "string" && /^(?:[1-9]|10|11)$/.test(cardMonths)) next.credit_card_revolving_months = "1_to_11_months";
  for (const retired of ["date_of_birth", "monthly_deductions", "monthly_deduction_amounts", "liquid_emergency_savings", "monthly_debt_payments", "credit_card_payment_behavior"]) delete next[retired];
  for (const key of SEASONAL_QUESTION_KEYS) {
    const value = next[key];
    const step = STEPS.find((step) => step.questionKey === key);
    const options = step ? availableOnboardingStep(step, next).options ?? [] : [];
    if (Array.isArray(value)) next[key] = value.filter((selection) => options.some((option) => option.key === selection));
  }
  return next;
}
