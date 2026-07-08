export const VALID_PLATFORMS = ["android", "ios", "web"];

export const AUTH_ERRORS = {
  bad_request: "Invalid request. Check your input and try again.",
  unauthorized: "Invalid email or password.",
  email_not_verified: "Verify your email first, then sign in.",
  too_many_requests: "Too many attempts. Please wait and try again.",
  conflict: "An account with this email already exists.",
  google_failed: "Google sign-in failed.",
  token_expired: "Invalid or expired access token.",
  token_required: "Authorization header is required.",
  refresh_token_required: "Refresh token is required.",
  email_required: "Email is required.",
  password_required: "Password is required.",
  new_password_required: "New password is required.",
  display_name_optional: "",
  google_id_token_required: "Google ID token is required.",
  registration_failed: "Registration failed. Please try again.",
  bootstrap_failed: "Failed to bootstrap user session.",
  bootstrap_profile_failed: "Failed to bootstrap user profile.",
  password_reset_failed: "Password reset request failed. Please try again.",
  password_update_failed: "Password update failed.",
  logout_failed: "Logout failed.",
  session_failed: "Failed to restore your session.",
  generic: "Something went wrong. Please try again.",
} as const;

export const VALID_METRO_MANILA_PRESENCE = [
  "lives_in_metro_manila",
  "works_in_metro_manila",
  "lives_and_works_in_metro_manila",
];

export const VALID_EMPLOYMENT_CLASSIFICATIONS = [
  "full_time_employee",
  "part_time_employee",
  "self_employed",
  "freelancer",
  "business_owner",
  "entrepreneur",
  "contractual_project_based",
  "gig_worker",
  "other",
];

export const VALID_CONSENT_KINDS = [
  "data_collection",
  "personalization",
  "model_training",
  "research_evaluation",
  "notifications",
  "terms",
  "advisory_disclaimer",
];

export const VALID_CONSENT_STATUSES = ["granted", "withdrawn"];

export const VALID_REQUEST_STATUSES = [
  "requested",
  "processing",
  "available",
  "completed",
  "failed",
  "expired",
  "cancelled",
];

export const PRIVACY_SETTINGS_DEFAULTS = {
  personalization_enabled: true,
  model_training_opt_in: false,
  research_evaluation_opt_in: false,
  notifications_opt_in: false,
  data_retention_days: null,
} as const;

export const ONBOARDING_ERRORS = {
  session_not_found: "Onboarding session not found.",
  session_not_in_progress: "Session is not in progress.",
  session_belongs_to_another_user: "Session does not belong to the authenticated user.",
  session_already_submitted: "Session has already been submitted.",
  response_create_failed: "Failed to save onboarding response.",
  session_create_failed: "Failed to create onboarding session.",
  session_update_failed: "Failed to update onboarding session.",
  session_fetch_failed: "Failed to fetch onboarding sessions.",
  no_active_session: "No active onboarding session found.",
  submit_failed: "Failed to submit onboarding session.",
  submit_not_confirmed: "You must confirm data use before submitting.",
  eligibility_incomplete: "Your eligibility profile must be complete before submitting.",
} as const;

export const ONBOARDING_STATUSES = [
  "not_started",
  "in_progress",
  "submitted",
  "abandoned",
  "superseded",
] as const;

export const FINANCIAL_PROFILE_LABELS = [
  "stable_flexible",
  "stable_obligated",
  "variable_flexible",
  "variable_obligated",
] as const;

export const PROFILE_ASSESSMENT_STATUSES = [
  "queued",
  "running",
  "suggested",
  "confirmed",
  "rejected",
  "failed",
  "expired",
] as const;

export const PROFILE_EVENT_ACTIONS = [
  "assessment_requested",
  "assessment_generated",
  "change_suggested",
  "confirmed",
  "rejected",
  "manual_override",
  "activated",
  "deactivated",
] as const;

export const PROFILE_ASSESSMENT_METHODS = [
  "manual",
  "questionnaire",
  "cold_start",
  "standard",
] as const;

export const PROFILE_ERRORS = {
  assignment_not_found: "Assignment not found.",
  confirmation_required: "You must confirm before proceeding.",
  select_failed: "Failed to select profile.",
  confirm_failed: "Failed to confirm assignment.",
  reject_failed: "Failed to reject assignment.",
  reject_reason_required: "Override reason is required.",
  fetch_failed: "Failed to fetch profile assignment.",
  invalid_assignment_id: "Invalid assignment ID format.",
  invalid_profile_label: "Invalid profile label. Must be one of: stable_flexible, stable_obligated, variable_flexible, variable_obligated.",
  reassess_failed: "Failed to request reassessment.",
} as const;
