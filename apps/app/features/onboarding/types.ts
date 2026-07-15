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
