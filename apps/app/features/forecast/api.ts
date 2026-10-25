import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type { ForecastPayload, ForecastRequest, ForecastUnavailableReason, QuarterlyForecastPayload } from "./types";
import { authorizedFetch } from "../../lib/localAccess";

export function requestForecast(accessToken: string, request: ForecastRequest, signal?: AbortSignal) {
  return postForecast<ForecastPayload>("/odin/api/forecast", accessToken, request, signal);
}

export function requestQuarterlyForecast(accessToken: string, request: ForecastRequest, signal?: AbortSignal) {
  return postForecast<QuarterlyForecastPayload>("/odin/api/forecast/quarterly", accessToken, request, signal);
}

export function requestForecastInterpretation(accessToken: string, notes: string[], signal?: AbortSignal) {
  return postForecast<{ notes: string[] }>("/odin/api/forecast/interpretation", accessToken, { notes }, signal);
}

async function postForecast<T>(path: string, accessToken: string, request: ForecastRequest | { notes: string[] }, signal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await authorizedFetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    let body: { payload?: T | null; reason?: ForecastUnavailableReason; error?: string; message?: string } = {};
    try { body = await response.json(); } catch {}
    return { response, body };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abort);
  }
}
