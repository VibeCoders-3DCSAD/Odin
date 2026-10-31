import type { Alert, AlertPage, AlertAction } from "./types";
import { apiFetch } from "../../lib/helpers/apiFetch";

type ApiBody<T> = T & { error?: string; message?: string };

export function getAlerts(accessToken: string, cursor?: string, limit?: number) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return apiFetch<ApiBody<AlertPage>>(accessToken, `/odin/api/alerts${query ? `?${query}` : ""}`);
}

export function getAlertDetail(accessToken: string, alertId: string) {
  return apiFetch<ApiBody<{ alert: Alert }>>(accessToken, `/odin/api/alerts/${encodeURIComponent(alertId)}`);
}

export function updateAlert(accessToken: string, alertId: string, action: AlertAction, snoozeUntil?: string, createWhitelist = false) {
  return apiFetch<ApiBody<{ alert: Alert }>>(accessToken, `/odin/api/alerts/${encodeURIComponent(alertId)}`, {
    method: "PATCH",
    body: { action, snooze_until: snoozeUntil, create_whitelist: createWhitelist },
  });
}

export function clearAlerts(accessToken: string) {
  return apiFetch<ApiBody<{ cleared: number }>>(accessToken, "/odin/api/alerts/clear", {
    method: "POST",
    body: { confirmation_token: "CLEAR_ALERTS" },
  });
}
