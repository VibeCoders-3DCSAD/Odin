export type AlertCategory = "anomaly_detection" | "budget_overspending";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "unread" | "read" | "acknowledged" | "dismissed" | "cleared";

export type AlertAction =
  | "read"
  | "acknowledge"
  | "dismiss"
  | "snooze"
  | "expected"
  | "unexpected";

export type AlertRelatedEntity = {
  entity_type: string;
  entity_id: string;
  label: string | null;
  amount_centavos: number | null;
  metadata: Record<string, unknown>;
};

export type Alert = {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  body: string;
  explanation: string | null;
  action_label: string | null;
  route_name: string | null;
  route_params: Record<string, unknown>;
  related_entities: AlertRelatedEntity[];
  metadata: Record<string, unknown>;
  remote_revision: string | null;
  triggered_at: string;
  read_at: string | null;
  acknowledged_at: string | null;
  dismissed_at: string | null;
  remind_at: string | null;
  expires_at: string | null;
  allowed_actions: AlertAction[];
};

export type AlertPage = {
  alerts: Alert[];
  next_cursor: string | null;
  has_more: boolean;
};

export type AlertCacheRecord = Alert & {
  user_id: string;
  cached_at: string;
  stale: boolean;
};

export type AlertCachePageOptions = {
  cursor?: string | null;
  replace_before?: string | null;
};
