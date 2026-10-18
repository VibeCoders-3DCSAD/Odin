import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyFinancialCondition } from "../lib/mlClient.js";

export type FinancialConditionAssessment = {
  id: string;
  assessed_at: string;
  rule_set_version: string;
  input_snapshot: Record<string, unknown>;
  output_snapshot: Record<string, unknown>;
};

type OnboardingAnswers = Record<string, unknown>;

function wholeNumber(answers: OnboardingAnswers, key: string) {
  const value = answers[key];
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
}

function selfReportedRevolvingMonths(answers: OnboardingAnswers) {
  switch (answers.credit_card_payment_behavior) {
    case "never":
      return 0;
    case "every_month":
      return 12;
    case "some_months":
    case "not_sure": {
      const months = wholeNumber(answers, "credit_card_revolving_months");
      return months !== null && months <= 12 ? months : null;
    }
    default:
      return null;
  }
}

function onboardingAssessmentInput(answers: OnboardingAnswers) {
  const grossIncome = wholeNumber(answers, "monthly_income");
  const essentialCosts = wholeNumber(answers, "monthly_essential_living_costs");
  const emergencySavings = wholeNumber(answers, "liquid_emergency_savings");
  const debtPayments = answers.paying_off_debt === "false" ? 0 : wholeNumber(answers, "monthly_debt_payments");
  const deductions = answers.monthly_deduction_amounts;
  const nonDebtDeductions = deductions && typeof deductions === "object" && !Array.isArray(deductions)
    ? Object.entries(deductions).reduce((total, [key, amount]) => key === "salary_loan" || typeof amount !== "string" || !/^\d+$/.test(amount) ? total : total + Number(amount), 0)
    : 0;

  return {
    classification_as_of: new Date().toISOString().slice(0, 10),
    liquid_emergency_savings: emergencySavings,
    average_monthly_recurring_essential_expenses: essentialCosts,
    // Salary-loan deductions are included in the declared debt payment below.
    monthly_disposable_income: grossIncome === null ? null : Math.max(grossIncome - nonDebtDeductions, 0),
    required_monthly_debt_payments: debtPayments,
    monthly_basic_living_costs: essentialCosts,
    credit_card_accounts: [],
    self_reported_revolving_months: selfReportedRevolvingMonths(answers),
    assessment_source: "onboarding_questionnaire",
    self_reported_credit_card_behavior: answers.credit_card_payment_behavior ?? null,
  };
}

async function saveAssessment(userId: string, input: Record<string, unknown>, supabase: SupabaseClient): Promise<FinancialConditionAssessment | null> {
  const result = await classifyFinancialCondition(userId, input);
  if (!result.ok) return null;

  const { data: assessment, error: insertError } = await supabase
    .from("financial_condition_assessments")
    .insert({ user_id: userId, rule_set_version: result.modelVersion, input_snapshot: input, output_snapshot: result.classification })
    .select("id, assessed_at, rule_set_version, input_snapshot, output_snapshot")
    .single();
  if (insertError || !assessment) return null;
  return assessment as FinancialConditionAssessment;
}

export async function createFinancialConditionAssessment(userId: string, supabase: SupabaseClient): Promise<FinancialConditionAssessment | null> {
  const { data: input, error } = await supabase.rpc("get_financial_classification_v2_input", { p_user_id: userId });
  if (error || !input || typeof input !== "object" || Array.isArray(input)) return null;

  // The ML service uses the onboarding self-report only when no card history exists,
  // so refreshes keep a credit-card result for users without recorded statements.
  const { data: onboarding } = await supabase
    .from("onboarding_sessions")
    .select("raw_answers")
    .eq("user_id", userId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const answers = onboarding?.raw_answers && typeof onboarding.raw_answers === "object" ? onboarding.raw_answers as OnboardingAnswers : {};

  return saveAssessment(userId, { ...input, self_reported_revolving_months: selfReportedRevolvingMonths(answers) }, supabase);
}

export function createOnboardingFinancialConditionAssessment(userId: string, answers: OnboardingAnswers, supabase: SupabaseClient) {
  return saveAssessment(userId, onboardingAssessmentInput(answers), supabase);
}
