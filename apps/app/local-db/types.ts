export type SyncOperationStatus = "pending" | "synced" | "failed" | "discarded";

export type SyncOperationType = "create" | "update" | "delete";

export type SyncableEntity =
  | "categories"
  | "subcategories"
  | "category_groups"
  | "financial_accounts"
  | "transactions"
  | "budgets"
  | "savings_goals"
  | "debt_accounts"
  | "alerts"
  | "notification_preferences";

export type SyncOperation = {
  operation_id: string;
  user_id: string;
  device_id: string;
  entity: SyncableEntity;
  record_id: string;
  operation_type: SyncOperationType;
  base_version: number | null;
  changed_fields: string[];
  payload: Record<string, unknown>;
  failure_message: string;
  status: SyncOperationStatus;
  attempts: number;
  last_error: string | null;
  discarded_at: string | null;
  created_at: string;
};

export type SyncState = {
  user_id: string;
  device_id: string;
  pull_cursor: string | null;
  last_sync_at: string | null;
};

export type EnqueueInput = {
  userId: string;
  deviceId: string;
  entity: SyncableEntity;
  recordId: string;
  operationType: SyncOperationType;
  baseVersion: number | null;
  changedFields: string[];
  payload: Record<string, unknown>;
  failureMessage: string;
};
