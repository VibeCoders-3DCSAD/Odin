import type { PrivacySettings } from "./types";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const requestTimeoutMs = 10_000;

export async function getPrivacySettings(accessToken: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}/odin/api/privacy/settings`, {
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
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}/odin/api/privacy/settings`, {
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
