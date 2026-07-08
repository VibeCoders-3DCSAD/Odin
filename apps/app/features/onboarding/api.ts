import { apiFetch } from "../../lib/api";
import type { OnboardingSession, OnboardingResponse, OnboardingSubmitResult } from "./types";

export function createOnboardingSession(
  accessToken: string,
  payload: { raw_answers?: Record<string, unknown>; current_step_key?: string },
) {
  return apiFetch<{
    payload?: { session: OnboardingSession };
    error?: string;
    message?: string;
  }>(accessToken, "/odin/api/onboarding/sessions", { method: "POST", body: { payload } });
}

export function updateOnboardingSession(
  accessToken: string,
  sessionId: string,
  payload: { raw_answers?: Record<string, unknown>; current_step_key?: string },
) {
  return apiFetch<{
    payload?: { session: OnboardingSession };
    error?: string;
    message?: string;
  }>(accessToken, `/odin/api/onboarding/sessions/${sessionId}`, { method: "PATCH", body: { payload } });
}

export function saveOnboardingResponse(
  accessToken: string,
  sessionId: string,
  payload: { question_key: string; answer: unknown },
) {
  return apiFetch<{
    payload?: { response: OnboardingResponse };
    error?: string;
    message?: string;
  }>(accessToken, `/odin/api/onboarding/sessions/${sessionId}/responses`, { method: "POST", body: { payload } });
}

export function submitOnboardingSession(
  accessToken: string,
  sessionId: string,
  payload: { confirm_data_use: true },
) {
  return apiFetch<{
    payload?: OnboardingSubmitResult;
    error?: string;
    message?: string;
  }>(accessToken, `/odin/api/onboarding/sessions/${sessionId}/submit`, { method: "POST", body: { payload } });
}

export function getCurrentOnboardingSession(accessToken: string) {
  return apiFetch<{
    payload?: { session: OnboardingSession | null };
    error?: string;
    message?: string;
  }>(accessToken, "/odin/api/onboarding/sessions/current");
}
