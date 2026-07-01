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
