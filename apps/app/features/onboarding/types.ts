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
    key: "protected_category_costs",
    title: "Household Support Costs",
    subtitle: "Enter the monthly support or essential cost for each option you selected.",
    kind: "amount_list",
    questionKey: "protected_category_costs",
    amountSourceKey: "protected_categories",
    amountOptions: [
      { key: "dependents_children", label: "Children" },
      { key: "dependents_elderly", label: "Elderly Dependents" },
      { key: "pwd", label: "Person with Disability" },
      { key: "solo_parent", label: "Solo Parent Responsibilities" },
      { key: "indigenous", label: "Indigenous Community Needs" },
    ],
  },
  {
    key: "high_expense_seasons",
    title: "Higher-Expense Seasons",
    subtitle: "When are your expenses usually higher? Select all that apply.",
    kind: "card_multi_select",
    questionKey: "high_expense_seasons",
    options: [
      { key: "rainy_season", label: "Rainy Season" },
      { key: "back_to_school", label: "Back-to-School Season" },
      { key: "undas", label: "Undas / All Souls' Day" },
      { key: "christmas_ber_months", label: "Christmas and Ber Months" },
      { key: "new_year", label: "New Year" },
      { key: "summer", label: "Summer" },
      { key: "annual_payments", label: "Tax and Annual-Payment Season" },
      { key: "family_celebrations", label: "Birthday and Family-Celebration Months" },
      { key: "other", label: "Other" },
      { key: "none", label: "My Expenses Do Not Usually Change by Season" },
    ],
  },
  {
    key: "saving_seasons",
    title: "Saving Seasons",
    subtitle: "What seasons are more likely for you to save? Select all that apply.",
    kind: "card_multi_select",
    questionKey: "saving_seasons",
    options: [
      { key: "rainy_season", label: "Rainy Season" },
      { key: "back_to_school", label: "Back-to-School Season" },
      { key: "christmas_ber_months", label: "Christmas and Ber Months" },
      { key: "new_year", label: "New Year" },
      { key: "summer", label: "Summer" },
      { key: "other", label: "Other" },
      { key: "none", label: "No Particular Seasonal Pattern" },
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
