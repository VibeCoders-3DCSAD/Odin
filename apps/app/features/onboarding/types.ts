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

export type OnboardingResponse = {
  onboarding_session_id: string;
  question_key: string;
  answer: unknown;
  updated_at: string;
};

export type StepKind = "card_select" | "card_multi_select" | "dropdown" | "input" | "review" | "result";

export type StepOption = {
  key: string;
  label: string;
  description?: string;
};

export type StepConfig = {
  key: string;
  index: number;
  title: string;
  subtitle?: string;
  kind: StepKind;
  questionKey: string;
  options?: StepOption[];
  inputPlaceholder?: string;
  inputLabel?: string;
  inputSuffix?: string;
};

export const STEPS: StepConfig[] = [
  {
    key: "employment",
    index: 0,
    title: "Employment Status",
    subtitle: "Select the option that best describes your current employment.",
    kind: "card_select",
    questionKey: "employment_status",
    options: [
      { key: "employed_full_time", label: "Employed Full-Time" },
      { key: "employed_part_time", label: "Employed Part-Time" },
      { key: "self_employed", label: "Self-Employed" },
      { key: "unemployed", label: "Unemployed" },
      { key: "retired", label: "Retired" },
      { key: "student", label: "Student" },
    ],
  },
  {
    key: "income_stability",
    index: 1,
    title: "Income Stability",
    subtitle: "How stable is your primary source of income?",
    kind: "card_select",
    questionKey: "income_type",
    options: [
      { key: "very_stable", label: "Very Stable", description: "Fixed salary, government or tenured position" },
      { key: "stable", label: "Stable", description: "Regular salary with predictable earnings" },
      { key: "somewhat_unstable", label: "Somewhat Unstable", description: "Variable hours, commission-based" },
      { key: "very_unstable", label: "Very Unstable", description: "Freelance, gig work, irregular income" },
    ],
  },
  {
    key: "pay_frequency",
    index: 2,
    title: "Pay Frequency",
    subtitle: "How often do you receive your primary income?",
    kind: "dropdown",
    questionKey: "pay_frequency",
    options: [
      { key: "weekly", label: "Weekly" },
      { key: "bi_weekly", label: "Bi-weekly" },
      { key: "semi_monthly", label: "Semi-monthly (15th & 30th)" },
      { key: "monthly", label: "Monthly" },
      { key: "irregular", label: "Irregular / Contract-based" },
      { key: "annual", label: "Annual" },
    ],
  },
  {
    key: "monthly_income",
    index: 3,
    title: "Monthly Income",
    subtitle: "Enter your average monthly take-home income.",
    kind: "input",
    questionKey: "monthly_income",
    inputLabel: "Average Monthly Income",
    inputSuffix: "PHP",
  },
  {
    key: "fixed_obligations",
    index: 4,
    title: "Fixed Monthly Obligations",
    subtitle: "Select all that apply, then enter your total monthly obligations.",
    kind: "card_multi_select",
    questionKey: "fixed_obligation_types",
    options: [
      { key: "rent_mortgage", label: "Rent / Mortgage" },
      { key: "loan_payments", label: "Loan Payments" },
      { key: "insurance", label: "Insurance Premiums" },
      { key: "utilities", label: "Utilities" },
      { key: "tuition", label: "Tuition / School Fees" },
      { key: "support_payments", label: "Support Payments" },
      { key: "none", label: "None of the above" },
    ],
  },
  {
    key: "dependents_protected",
    index: 5,
    title: "Dependents & Protected Status",
    subtitle: "Select any that apply to your household.",
    kind: "card_multi_select",
    questionKey: "protected_categories",
    options: [
      { key: "dependents_children", label: "Dependents — Children", description: "Minor children in your household" },
      { key: "dependents_elderly", label: "Dependents — Elderly", description: "Senior dependents under your care" },
      { key: "pwd", label: "Person with Disability" },
      { key: "solo_parent", label: "Solo Parent" },
      { key: "indigenous", label: "Indigenous Community Member" },
      { key: "none", label: "None of the above" },
    ],
  },
  {
    key: "review",
    index: 6,
    title: "Review Your Profile",
    subtitle: "Review your answers before submitting.",
    kind: "review",
    questionKey: "_review",
  },
];
