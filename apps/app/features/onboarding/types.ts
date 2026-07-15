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
    key: "display_name",
    title: "What should we call you?",
    kind: "input",
    questionKey: "display_name",
    inputPlaceholder: "Your name",
  },
  {
    key: "date_of_birth",
    title: "Date of Birth",
    subtitle: "Enter your date of birth to confirm eligibility.",
    kind: "input",
    questionKey: "date_of_birth",
    inputLabel: "Date of Birth (YYYY-MM-DD)",
  },
  {
    key: "nationality",
    title: "Filipino Citizenship",
    subtitle: "Are you a Filipino citizen?",
    kind: "card_select",
    questionKey: "is_filipino",
    options: [
      { key: "true", label: "Yes", description: "I am a Filipino citizen" },
      { key: "false", label: "No", description: "I am not a Filipino citizen" },
    ],
  },
  {
    key: "metro_manila",
    title: "Metro Manila Presence",
    subtitle: "Do you live or work in Metro Manila?",
    kind: "card_select",
    questionKey: "metro_manila_presence",
    options: [
      { key: "lives_in_metro_manila", label: "Live in Metro Manila" },
      { key: "works_in_metro_manila", label: "Work in Metro Manila" },
      { key: "lives_and_works_in_metro_manila", label: "Live & Work in Metro Manila" },
    ],
  },
  {
    key: "employment_classification",
    title: "Employment Classification",
    subtitle: "Select the option that best describes your employment.",
    kind: "card_select",
    questionKey: "primary_employment_classification",
    options: [
      { key: "full_time_employee", label: "Full-Time Employee" },
      { key: "part_time_employee", label: "Part-Time Employee" },
      { key: "self_employed", label: "Self-Employed" },
      { key: "freelancer", label: "Freelancer" },
      { key: "business_owner", label: "Business Owner" },
      { key: "entrepreneur", label: "Entrepreneur" },
      { key: "contractual_project_based", label: "Contractual / Project-Based" },
      { key: "gig_worker", label: "Gig Worker" },
      { key: "other", label: "Other" },
    ],
  },
  {
    key: "employment",
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
    title: "Income Stability",
    subtitle: "How stable is your primary source of income?",
    kind: "card_select",
    questionKey: "income_stability",
    options: [
      { key: "very_stable", label: "Very Stable", description: "Fixed salary, government or tenured position" },
      { key: "stable", label: "Stable", description: "Regular salary with predictable earnings" },
      { key: "somewhat_unstable", label: "Somewhat Unstable", description: "Variable hours, commission-based" },
      { key: "very_unstable", label: "Very Unstable", description: "Freelance, gig work, irregular income" },
    ],
  },
  {
    key: "pay_frequency",
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
    title: "Monthly Income",
    subtitle: "Enter your average monthly take-home income.",
    kind: "input",
    questionKey: "monthly_income",
    inputLabel: "Average Monthly Income",
    inputSuffix: "PHP",
  },
  {
    key: "fixed_obligations",
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
    title: "Review Your Profile",
    subtitle: "Review your answers before submitting.",
    kind: "review",
    questionKey: "_review",
  },
];
