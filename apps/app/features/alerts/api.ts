import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type { Alert, AlertPage, AlertAction } from "./types";

type ApiBody<T> = T & { error?: string; message?: string };

function apiFetch<T>(accessToken: string, path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
    signal: controller.signal,
  })
    .then(async (res) => {
      let body: unknown = {};
      try { body = await res.json(); } catch {}
      return { response: res, body: body as T };
    })
    .finally(() => clearTimeout(timeoutId));
}

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
    body: JSON.stringify({ action, snooze_until: snoozeUntil, create_whitelist: createWhitelist }),
  });
}

export function clearAlerts(accessToken: string) {
  return apiFetch<ApiBody<{ cleared: number }>>(accessToken, "/odin/api/alerts/clear", {
    method: "POST",
    body: JSON.stringify({ confirmation_token: "CLEAR_ALERTS" }),
  });
}
