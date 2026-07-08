import { apiFetch } from "../../lib/api";
import type {
  ProfileAssignmentCurrent,
  FinancialProfileLabel,
  ProfileAssessmentMethod,
  ConfirmAssignmentResult,
  RejectAssignmentResult,
  SelectProfileResult,
  ReassessResult,
} from "./types";

export function getCurrentProfileAssignment(accessToken: string) {
  return apiFetch<{
    payload?: ProfileAssignmentCurrent;
    error?: string;
    message?: string;
  }>(accessToken, "/odin/api/profile/assignment/current");
}

export function confirmProfileAssignment(
  accessToken: string,
  payload: { assignment_id: string; confirmation: true },
) {
  return apiFetch<{
    payload?: ConfirmAssignmentResult;
    error?: string;
    message?: string;
  }>(accessToken, "/odin/api/profile/assignment/confirm", { method: "POST", body: { payload } });
}

export function rejectProfileAssignment(
  accessToken: string,
  payload: { assignment_id: string; override_reason: string },
) {
  return apiFetch<{
    payload?: RejectAssignmentResult;
    error?: string;
    message?: string;
  }>(accessToken, "/odin/api/profile/assignment/reject", { method: "POST", body: { payload } });
}

export function selectProfileAssignment(
  accessToken: string,
  payload: { profile_label: FinancialProfileLabel },
) {
  return apiFetch<{
    payload?: SelectProfileResult;
    error?: string;
    message?: string;
  }>(accessToken, "/odin/api/profile/assignment/select", { method: "POST", body: { payload } });
}

export function requestProfileReassessment(
  accessToken: string,
  payload?: {
    reason?: string;
    use_recent_transactions?: boolean;
    assessment_method?: ProfileAssessmentMethod;
  },
) {
  return apiFetch<{
    payload?: ReassessResult;
    error?: string;
    message?: string;
  }>(accessToken, "/odin/api/profile/reassess", { method: "POST", body: { payload: payload ?? {} } });
}
