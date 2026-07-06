export type PrivacySettings = {
  personalization_enabled: boolean;
  model_training_opt_in: boolean;
  research_evaluation_opt_in: boolean;
  notifications_opt_in: boolean;
  data_retention_days: number | null;
};

export type ConsentRecord = {
  consent_kind: string;
  status: "granted" | "withdrawn";
  version: string;
  recorded_at: string;
};

export type DataExportRequest = {
  request: {
    id: string;
    status: "requested" | "processing" | "available" | "completed" | "failed" | "expired" | "cancelled";
  };
};
