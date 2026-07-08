export type FinancialProfileLabel =
  | "stable_flexible"
  | "stable_obligated"
  | "variable_flexible"
  | "variable_obligated";

export type ProfileAssessmentMethod =
  | "manual"
  | "questionnaire"
  | "cold_start"
  | "standard";

export type ProfileAssessmentStatus =
  | "queued"
  | "running"
  | "suggested"
  | "confirmed"
  | "rejected"
  | "failed"
  | "expired";

export type ProfileAssignment = {
  id: string;
  user_id: string;
  assessment_id: string | null;
  profile_label: FinancialProfileLabel;
  is_active: boolean;
  confirmation_required: boolean;
  effective_from: string | null;
  confirmed_at: string | null;
  rejected_at: string | null;
  explanation: string | null;
  created_at: string;
};

export type ExplanationDriver = {
  driver_key: string;
  driver_label: string;
  value_text: string | null;
  impact_label: string;
  explanation: string;
  sort_order: number;
};

export type ProfileAssignmentCurrent = {
  assignment: ProfileAssignment | null;
  drivers: ExplanationDriver[];
};

export type ConfirmAssignmentPayload = {
  assignment_id: string;
  confirmation: true;
};

export type RejectAssignmentPayload = {
  assignment_id: string;
  override_reason: string;
};

export type SelectProfilePayload = {
  profile_label: FinancialProfileLabel;
};

export type ReassessPayload = {
  reason?: string;
  use_recent_transactions?: boolean;
  assessment_method?: ProfileAssessmentMethod;
};
