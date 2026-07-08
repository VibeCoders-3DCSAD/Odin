import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type {
  ProfileAssignmentCurrent,
  FinancialProfileLabel,
  ProfileAssessmentMethod,
} from "./types";

function profileFetch<T>(
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

export function getCurrentProfileAssignment(accessToken: string) {
  return profileFetch<{
    payload?: ProfileAssignmentCurrent;
    error?: string;
    message?: string;
  }>(accessToken, "/profile/assignment/current");
}

export function confirmProfileAssignment(
  accessToken: string,
  payload: { assignment_id: string; confirmation: true },
) {
  return profileFetch<{
    payload?: { success: boolean };
    error?: string;
    message?: string;
  }>(accessToken, "/profile/assignment/confirm", { method: "POST", body: { payload } });
}

export function rejectProfileAssignment(
  accessToken: string,
  payload: { assignment_id: string; override_reason: string },
) {
  return profileFetch<{
    payload?: { success: boolean };
    error?: string;
    message?: string;
  }>(accessToken, "/profile/assignment/reject", { method: "POST", body: { payload } });
}

export function selectProfileAssignment(
  accessToken: string,
  payload: { profile_label: FinancialProfileLabel },
) {
  return profileFetch<{
    payload?: { success: boolean };
    error?: string;
    message?: string;
  }>(accessToken, "/profile/assignment/select", { method: "POST", body: { payload } });
}

export function requestProfileReassessment(
  accessToken: string,
  payload?: {
    reason?: string;
    use_recent_transactions?: boolean;
    assessment_method?: ProfileAssessmentMethod;
  },
) {
  return profileFetch<{
    payload?: { success: boolean; assessment_id: string; status: string; assessment_method: string };
    error?: string;
    message?: string;
  }>(accessToken, "/profile/reassess", { method: "POST", body: { payload: payload ?? {} } });
}
