export type PrivacySettings = {
  personalization_enabled: boolean;
  model_training_opt_in: boolean;
  research_evaluation_opt_in: boolean;
  notifications_opt_in: boolean;
  data_retention_days: number | null;
};

export type ConsentRecord = {
  id: string;
  policy_version: string;
  accepted_at: string;
  terms_accepted: boolean;
  privacy_accepted: boolean;
};

export type DataExportRequest = {
  id: string;
  status: "requested" | "processing" | "completed" | "failed";
  created_at: string;
  completed_at?: string;
};
