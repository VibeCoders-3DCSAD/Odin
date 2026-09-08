import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type { ForecastPayload, ForecastRequest } from "./types";

export async function requestForecast(accessToken: string, request: ForecastRequest) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/odin/api/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    let body: { payload?: ForecastPayload; error?: string; message?: string } = {};
    try { body = await response.json(); } catch {}
    return { response, body };
  } finally {
    clearTimeout(timeoutId);
  }
}
