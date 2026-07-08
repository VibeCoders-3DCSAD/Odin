export type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "abandoned"
  | "superseded";

export type OnboardingSession = {
  id: string;
  user_id: string;
  status: OnboardingStatus;
  started_at: string;
  submitted_at: string | null;
  current_step_key: string | null;
  raw_answers: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
};

export type OnboardingResponse = {
  onboarding_session_id: string;
  question_key: string;
  answer: unknown;
  updated_at: string;
};

export type OnboardingSubmitResult = {
  session: { id: string; status: "submitted" };
  assessment: { id: string; proposed_profile_label: string };
  assignment: {
    id: string;
    profile_label: string;
    confirmation_required: boolean;
  };
};

export type CreateSessionPayload = {
  raw_answers?: Record<string, unknown>;
  current_step_key?: string;
};

export type UpdateSessionPayload = {
  raw_answers?: Record<string, unknown>;
  current_step_key?: string;
};

export type SaveResponsePayload = {
  question_key: string;
  answer: unknown;
};

export type SubmitSessionPayload = {
  confirm_data_use: true;
};
