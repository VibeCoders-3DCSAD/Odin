import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type { OnboardingSession, OnboardingResponse, OnboardingSubmitResult } from "./types";

function onboardingFetch<T>(
  accessToken: string,
  path: string,
  options?: { method?: string; body?: unknown },
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(`${API_BASE_URL}/odin/api${path}`, {
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
      try {
        body = await res.json();
      } catch {}
      return { response: res, body } as { response: Response; body: T };
    })
    .finally(() => clearTimeout(timeoutId));
}

export function createOnboardingSession(
  accessToken: string,
  payload: { raw_answers?: Record<string, unknown>; current_step_key?: string },
) {
  return onboardingFetch<{
    payload?: { session: OnboardingSession };
    error?: string;
    message?: string;
  }>(accessToken, "/onboarding/sessions", { method: "POST", body: { payload } });
}

export function updateOnboardingSession(
  accessToken: string,
  sessionId: string,
  payload: { raw_answers?: Record<string, unknown>; current_step_key?: string },
) {
  return onboardingFetch<{
    payload?: { session: OnboardingSession };
    error?: string;
    message?: string;
  }>(accessToken, `/onboarding/sessions/${sessionId}`, { method: "PATCH", body: { payload } });
}

export function saveOnboardingResponse(
  accessToken: string,
  sessionId: string,
  payload: { question_key: string; answer: unknown },
) {
  return onboardingFetch<{
    payload?: { response: OnboardingResponse };
    error?: string;
    message?: string;
  }>(accessToken, `/onboarding/sessions/${sessionId}/responses`, { method: "POST", body: { payload } });
}

export function submitOnboardingSession(
  accessToken: string,
  sessionId: string,
  payload: { confirm_data_use: true },
) {
  return onboardingFetch<{
    payload?: OnboardingSubmitResult;
    error?: string;
    message?: string;
  }>(accessToken, `/onboarding/sessions/${sessionId}/submit`, { method: "POST", body: { payload } });
}

export function getCurrentOnboardingSession(accessToken: string) {
  return onboardingFetch<{
    payload?: { session: OnboardingSession | null };
    error?: string;
    message?: string;
  }>(accessToken, "/onboarding/sessions/current");
}
