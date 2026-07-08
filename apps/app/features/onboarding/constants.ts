export const ONBOARDING_ERRORS = {
  session_create_failed: "Failed to create onboarding session.",
  session_update_failed: "Failed to update onboarding session.",
  session_fetch_failed: "Failed to fetch onboarding session.",
  response_save_failed: "Failed to save response.",
  submit_failed: "Failed to submit onboarding session.",
  no_active_session: "No active onboarding session found.",
  generic: "Something went wrong. Please try again.",
} as const;

export const ONBOARDING_STEPS = [
  "income_type",
  "monthly_income",
  "monthly_obligations",
  "dependents",
  "review",
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number];

export const STEP_LABELS: Record<OnboardingStepKey, string> = {
  income_type: "Income Type",
  monthly_income: "Monthly Income",
  monthly_obligations: "Monthly Obligations",
  dependents: "Dependents",
  review: "Review & Submit",
};
