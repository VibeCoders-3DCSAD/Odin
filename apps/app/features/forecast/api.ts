import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type { ForecastPayload } from "./types";

function apiFetch<T>(accessToken: string, path: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal: controller.signal,
  })
    .then(async (res) => {
      let body = {};
      try { body = await res.json(); } catch {}
      return { response: res, body } as { response: Response; body: T };
    })
    .finally(() => clearTimeout(timeoutId));
}

export function getForecast(accessToken: string) {
  return apiFetch<{ payload?: ForecastPayload; error?: string; message?: string }>(
    accessToken,
    "/odin/api/forecast",
  );
}