import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type { PrivacySettings } from "./types";

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
