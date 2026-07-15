import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type { OnboardingSession, ProfileAssignment, OnboardingResponse } from "./types";

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

export function getCurrentSession(accessToken: string) {
  return apiFetch<{ payload?: { session: OnboardingSession | null }; error?: string; message?: string }>(
    accessToken,
    "/odin/api/onboarding/sessions/current",
  );
}

export function createSession(
  accessToken: string,
  rawAnswers?: Record<string, unknown>,
  currentStep?: string | null,
) {
  return apiFetch<{ payload?: { session: OnboardingSession }; error?: string; message?: string }>(
    accessToken,
    "/odin/api/onboarding/sessions",
    { method: "POST", body: { payload: { raw_answers: rawAnswers ?? {}, current_step_key: currentStep ?? null } } },
  );
}

export function updateSession(
  accessToken: string,
  sessionId: string,
  data: { raw_answers?: Record<string, unknown>; current_step_key?: string },
) {
  return apiFetch<{ payload?: { session: OnboardingSession }; error?: string; message?: string }>(
    accessToken,
    `/odin/api/onboarding/sessions/${sessionId}`,
    { method: "PATCH", body: { payload: data } },
  );
}

export function submitSession(accessToken: string, sessionId: string) {
  return apiFetch<{
    payload?: {
      session: { id: string; status: string };
      assessment: { id: string; proposed_profile_label: string };
      assignment: { id: string; profile_label: string; confirmation_required: boolean };
    };
    error?: string;
    message?: string;
  }>(
    accessToken,
    `/odin/api/onboarding/sessions/${sessionId}/submit`,
    { method: "POST", body: { payload: { confirm_data_use: true } } },
  );
}

export function getProfileAssignment(accessToken: string) {
  return apiFetch<{ payload?: { assignment: ProfileAssignment | null; drivers: unknown[] }; error?: string; message?: string }>(
    accessToken,
    "/odin/api/profile/assignment/current",
  );
}

export function upsertResponse(
  accessToken: string,
  sessionId: string,
  questionKey: string,
  answer: unknown,
) {
  return apiFetch<{ payload?: { response: OnboardingResponse }; error?: string; message?: string }>(
    accessToken,
    `/odin/api/onboarding/sessions/${sessionId}/responses`,
    { method: "POST", body: { payload: { question_key: questionKey, answer } } },
  );
}
