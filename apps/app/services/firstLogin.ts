import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../lib/api";

export async function completeFirstLogin(accessToken: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/odin/api/auth/first-login-complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error("Failed to complete first-login setup.");
  } finally {
    clearTimeout(timeoutId);
  }
}
