export type PrivacySettings = {
  personalization_enabled: boolean;
  model_training_opt_in: boolean;
  research_evaluation_opt_in: boolean;
  notifications_opt_in: boolean;
  data_retention_days: number | null;
};
