import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type { ConsentRecord, DataExportRequest, PrivacySettings } from "./types";

export async function getPrivacySettings(accessToken: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/odin/api/privacy/settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    let body = {};
    try {
      body = await response.json();
    } catch {}
    return { response, body } as {
      response: Response;
      body: { payload?: PrivacySettings; error?: string; message?: string };
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function updatePrivacySettings(
  accessToken: string,
  payload: Partial<PrivacySettings>,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/odin/api/privacy/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ payload }),
      signal: controller.signal,
    });
    let body = {};
    try {
      body = await response.json();
    } catch {}
    return { response, body } as {
      response: Response;
      body: { payload?: { privacy_settings: { updated_at: string } }; error?: string; message?: string };
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function apiFetch<T>(
  accessToken: string,
  path: string,
  options?: { method?: string; body?: unknown },
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(`${API_BASE_URL}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    signal: controller.signal,
  })
    .then(async (res) => {
      let body = {};
      try { body = await res.json(); } catch {}
      return { response: res, body } as { response: Response; body: T };
    })
    .finally(() => clearTimeout(timeoutId));
}

export function getConsents(accessToken: string) {
  return apiFetch<{ payload?: { consents: ConsentRecord[] }; error?: string; message?: string }>(
    accessToken, "/odin/api/me?include=consents",
  );
}

export function submitConsent(
  accessToken: string,
  payload: { consent_kind: string; status: string; version: string },
) {
  return apiFetch<{ payload?: { consent: ConsentRecord }; error?: string; message?: string }>(
    accessToken, "/odin/api/consents", { method: "POST", body: { payload } },
  );
}

export function requestDataExport(accessToken: string) {
  return apiFetch<{ payload?: DataExportRequest; error?: string; message?: string }>(
    accessToken, "/odin/api/data-export-requests", { method: "POST" },
  );
}
