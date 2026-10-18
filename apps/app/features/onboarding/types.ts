export type OnboardingSession = {
  id: string;
  user_id: string;
  status: "not_started" | "in_progress" | "submitted" | "abandoned" | "superseded";
  started_at: string;
  submitted_at: string | null;
  current_step_key: string | null;
  raw_answers: Record<string, unknown>;
};

export type ProfileAssignment = {
  id: string;
  user_id: string;
  profile_label: string;
  is_active: boolean;
  confirmation_required: boolean;
  effective_from: string;
  assessment_id: string | null;
  explanation: string | null;
};

export type StepKind = "card_select" | "card_multi_select" | "dropdown" | "input" | "amount_list" | "review" | "result";

export type StepOption = {
  key: string;
  label: string;
  description?: string;
};

export type StepConfig = {
  key: string;
  title: string;
  subtitle?: string;
  kind: StepKind;
  questionKey: string;
  options?: StepOption[];
  inputPlaceholder?: string;
  inputLabel?: string;
  inputSuffix?: string;
  amountSourceKey?: string;
  amountOptions?: StepOption[];
  visibleWhen?: { questionKey: string; value: string | readonly string[] };
};

export const EXPENSE_SEASON_OPTIONS: StepOption[] = [
  { key: "q1", label: "January–March" },
  { key: "q2", label: "April–June" },
  { key: "q3", label: "July–September" },
  { key: "q4", label: "October–December" },
  { key: "none", label: "No Particular Higher-Expense Season" },
];

export const STEPS: StepConfig[] = [
  {
    key: "display_name",
    title: "What should we call you?",
    kind: "input",
    questionKey: "display_name",
    inputPlaceholder: "Your name",
  },
  {
    key: "date_of_birth",
    title: "Date of Birth",
    subtitle: "Enter your date of birth.",
    kind: "input",
    questionKey: "date_of_birth",
    inputLabel: "Date of Birth (YYYY-MM-DD)",
  },
  {
    key: "monthly_income",
    title: "Monthly Income Before Deductions",
    subtitle: "Enter the amount you usually earn before tax, government contributions, loan deductions, or other deductions.",
    kind: "input",
    questionKey: "monthly_income",
    inputLabel: "Average Monthly Income Before Deductions",
    inputSuffix: "PHP",
  },
  {
    key: "monthly_deductions",
    title: "Monthly Income Deductions",
    subtitle: "What deductions are taken from your monthly income? Select all that apply.",
    kind: "card_multi_select",
    questionKey: "monthly_deductions",
    options: [
      { key: "tax", label: "Tax" },
      { key: "sss", label: "SSS" },
      { key: "philhealth", label: "PhilHealth" },
      { key: "pag_ibig", label: "Pag-IBIG" },
      { key: "salary_loan", label: "Salary Loan" },
      { key: "other", label: "Other" },
      { key: "none", label: "None" },
    ],
  },
  {
    key: "monthly_deduction_amounts",
    title: "Deduction Amounts",
    subtitle: "Enter the monthly amount for each deduction you selected.",
    kind: "amount_list",
    questionKey: "monthly_deduction_amounts",
    amountSourceKey: "monthly_deductions",
    amountOptions: [
      { key: "tax", label: "Tax" },
      { key: "sss", label: "SSS" },
      { key: "philhealth", label: "PhilHealth" },
      { key: "pag_ibig", label: "Pag-IBIG" },
      { key: "salary_loan", label: "Salary Loan" },
      { key: "other", label: "Other" },
    ],
  },
  {
    key: "emergency_savings_runway",
    title: "Savings Runway",
    subtitle: "If your income stopped today, about how long could your available savings cover your essential needs?",
    kind: "card_select",
    questionKey: "emergency_savings_runway",
    options: [
      { key: "less_than_1_month", label: "Less than 1 month" },
      { key: "1_to_3_months", label: "1–3 months" },
      { key: "3_to_6_months", label: "3–6 months" },
      { key: "more_than_6_months", label: "More than 6 months" },
      { key: "not_sure", label: "Not sure" },
    ],
  },
  {
    key: "liquid_emergency_savings",
    title: "Emergency Savings",
    subtitle: "Include cash or savings you can use right away. Do not include investments or money reserved for another purpose.",
    kind: "input",
    questionKey: "liquid_emergency_savings",
    inputLabel: "Available for Emergencies",
    inputSuffix: "PHP",
  },
  {
    key: "monthly_essential_living_costs",
    title: "Essential Living Costs",
    subtitle: "Include essentials such as food, housing, utilities, transport, medicine, and necessary care.",
    kind: "input",
    questionKey: "monthly_essential_living_costs",
    inputLabel: "Estimated Monthly Essential Costs",
    inputSuffix: "PHP",
  },
  {
    key: "paying_off_debt",
    title: "Current Debt",
    subtitle: "Are you currently paying off any debt?",
    kind: "card_select",
    questionKey: "paying_off_debt",
    options: [
      { key: "true", label: "Yes" },
      { key: "false", label: "No" },
    ],
  },
  {
    key: "monthly_debt_payments",
    title: "Monthly Debt Payments",
    subtitle: "Enter the total required payment across all debts each month, including payroll-deducted loans and credit-card minimums.",
    kind: "input",
    questionKey: "monthly_debt_payments",
    inputLabel: "Total Required Monthly Debt Payments",
    inputSuffix: "PHP",
    visibleWhen: { questionKey: "paying_off_debt", value: "true" },
  },
  {
    key: "credit_card_payment_behavior",
    title: "Credit Card Payments",
    subtitle: "Over the last 12 months, how often did you have an unpaid credit-card balance after the due date?",
    kind: "card_select",
    questionKey: "credit_card_payment_behavior",
    options: [
      { key: "no_credit_card", label: "I don't use a credit card" },
      { key: "never", label: "Never" },
      { key: "some_months", label: "Some months" },
      { key: "every_month", label: "Every month" },
      { key: "not_sure", label: "Not sure" },
    ],
  },
  {
    key: "credit_card_revolving_months",
    title: "Months With a Card Balance",
    subtitle: "In how many of the last 12 months did you have an unpaid credit-card balance after the due date?",
    kind: "dropdown",
    questionKey: "credit_card_revolving_months",
    options: Array.from({ length: 13 }, (_, months) => ({ key: String(months), label: months === 1 ? "1 month" : `${months} months` })),
    visibleWhen: { questionKey: "credit_card_payment_behavior", value: ["some_months", "not_sure"] },
  },
  {
    key: "high_expense_seasons",
    title: "Higher-Expense Seasons",
    subtitle: "When are your expenses usually higher? Select all that apply.",
    kind: "card_multi_select",
    questionKey: "high_expense_seasons",
    options: EXPENSE_SEASON_OPTIONS,
  },
  {
    key: "low_expense_seasons",
    title: "Lower-Expense Seasons",
    subtitle: "When are your expenses usually lower? Select all that apply. Seasons you selected for higher expenses are excluded.",
    kind: "card_multi_select",
    questionKey: "low_expense_seasons",
    options: EXPENSE_SEASON_OPTIONS.map((option) => option.key === "none" ? { ...option, label: "No Particular Lower-Expense Season" } : option),
  },
  {
    key: "saving_seasons",
    title: "Savings Seasons",
    subtitle: "What seasons are more likely for you to save? Select all that apply.",
    kind: "card_multi_select",
    questionKey: "saving_seasons",
    options: EXPENSE_SEASON_OPTIONS.map((option) => option.key === "none" ? { ...option, label: "No Particular Savings Season" } : option),
  },
  {
    key: "review",
    title: "Review Your Profile",
    subtitle: "Review your answers before submitting.",
    kind: "review",
    questionKey: "_review",
  },
];
