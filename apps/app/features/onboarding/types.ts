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
    subtitle: "Odin is tuned for ages 20–40 living in Metro Manila. You can still use the app if you're outside this range, but some assessments may not apply as accurately.",
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
    subtitle: "Odin is tuned for ages 20–40 living in Metro Manila. You can still use the app if you're outside this range, but some assessments may not apply as accurately.",
    kind: "card_select",
    questionKey: "metro_manila_presence",
    options: [
      { key: "lives_in_metro_manila", label: "Live in Metro Manila" },
      { key: "works_in_metro_manila", label: "Work in Metro Manila" },
      { key: "lives_and_works_in_metro_manila", label: "Live & Work in Metro Manila" },
    ],
  },
  {
    key: "metro_manila_locality",
    title: "Metro Manila Locality",
    subtitle: "Select the Metro Manila city or municipality where you live or work.",
    kind: "dropdown",
    questionKey: "metro_manila_locality_code",
    options: [
      { key: "caloocan", label: "Caloocan" }, { key: "las_pinas", label: "Las Pinas" }, { key: "makati", label: "Makati" }, { key: "malabon", label: "Malabon" }, { key: "mandaluyong", label: "Mandaluyong" }, { key: "manila", label: "Manila" }, { key: "marikina", label: "Marikina" }, { key: "muntinlupa", label: "Muntinlupa" }, { key: "navotas", label: "Navotas" }, { key: "paranaque", label: "Paranaque" }, { key: "pasay", label: "Pasay" }, { key: "pasig", label: "Pasig" }, { key: "quezon_city", label: "Quezon City" }, { key: "san_juan", label: "San Juan" }, { key: "taguig", label: "Taguig" }, { key: "valenzuela", label: "Valenzuela" }, { key: "pateros", label: "Pateros" },
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
    key: "monthly_income",
    title: "Monthly Income",
    subtitle: "Enter your average monthly take-home income.",
    kind: "input",
    questionKey: "monthly_income",
    inputLabel: "Average Monthly Income",
    inputSuffix: "PHP",
  },
  {
    key: "income_pattern",
    title: "Which best describes your income right now?",
    kind: "card_select",
    questionKey: "income_pattern",
    options: [
      { key: "no_current_income", label: "I do not currently receive income" },
      { key: "predictable_income", label: "It is about the same each month" },
      { key: "variable_income", label: "It changes from month to month" },
    ],
  },
  {
    key: "obligation_load",
    title: "How much of your income goes to required monthly payments?",
    kind: "card_select",
    questionKey: "obligation_load",
    options: [
      { key: "no_income_with_obligations", label: "I have no current income, but I have required payments" },
      { key: "no_income_without_obligations", label: "I have no current income or required payments" },
      { key: "low", label: "A small amount" },
      { key: "medium", label: "A moderate amount" },
      { key: "high", label: "A large amount" },
    ],
  },
  {
    key: "emergency_runway",
    title: "If your income stopped today, how long could your savings cover essential expenses?",
    kind: "card_select",
    questionKey: "emergency_runway",
    options: [
      { key: "less_than_1_month", label: "Less than 1 month" },
      { key: "1_to_3_months", label: "1 to 3 months" },
      { key: "3_to_6_months", label: "3 to 6 months" },
      { key: "6_plus_months", label: "More than 6 months" },
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
