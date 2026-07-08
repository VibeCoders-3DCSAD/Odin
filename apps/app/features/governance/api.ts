import { apiFetch } from "../../lib/api";
import type { AccountDeletionRequest, ConsentRecord, DataExportRequest, PrivacySettings } from "./types";

export function getPrivacySettings(accessToken: string) {
  return apiFetch<{ payload?: PrivacySettings; error?: string; message?: string }>(
    accessToken, "/odin/api/privacy/settings",
  );
}

export function updatePrivacySettings(accessToken: string, payload: Partial<PrivacySettings>) {
  return apiFetch<{ payload?: { privacy_settings: { updated_at: string } }; error?: string; message?: string }>(
    accessToken, "/odin/api/privacy/settings", { method: "PATCH", body: { payload } },
  );
}

export function getConsents(accessToken: string) {
  return apiFetch<{ payload?: { consents: ConsentRecord[] }; error?: string; message?: string }>(
    accessToken, "/odin/api/me?include=consents",
  );
}

export function submitConsent(
  accessToken: string,
  payload: { consent_kind: string; status: string; version: string },
) {
  return apiFetch<{ payload?: { consent: ConsentRecord }; error?: string; message?: string }>(
    accessToken, "/odin/api/consents", { method: "POST", body: { payload } },
  );
}

export function getDataExports(accessToken: string) {
  return apiFetch<{ payload?: { requests: { id: string; status: string; requested_at: string }[] }; error?: string; message?: string }>(
    accessToken, "/odin/api/data-export-requests",
  );
}

export function requestDataExport(accessToken: string) {
  return apiFetch<{ payload?: DataExportRequest; error?: string; message?: string }>(
    accessToken, "/odin/api/data-export-requests", { method: "POST", body: { payload: {} } },
  );
}

export function requestAccountDeletion(accessToken: string) {
  return apiFetch<{ payload?: { request: AccountDeletionRequest }; error?: string; message?: string }>(
    accessToken, "/odin/api/account-deletion-requests", { method: "POST", body: { payload: {} } },
  );
}

export function confirmAccountDeletion(accessToken: string, id: string) {
  return apiFetch<{ payload?: { request: AccountDeletionRequest }; error?: string; message?: string }>(
    accessToken, `/odin/api/account-deletion-requests/${id}/confirm`, { method: "POST", body: { payload: { confirmation: true } } },
  );
}

export function cancelAccountDeletion(accessToken: string, id: string) {
  return apiFetch<{ payload?: { request: AccountDeletionRequest }; error?: string; message?: string }>(
    accessToken, `/odin/api/account-deletion-requests/${id}/cancel`, { method: "POST" },
  );
}
