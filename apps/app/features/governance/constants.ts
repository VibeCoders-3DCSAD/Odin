export const ERRORS = {
  TIMEOUT: "The request timed out. Check your connection and try again.",
  GENERIC: "Something went wrong.",
  EXPORT_UNAVAILABLE: "Export service is unavailable.",
  EXPORT_UNAVAILABLE_RETRY: "Export service is unavailable. Please try again.",
  CONSENT_UNAVAILABLE: "Consent service is unavailable. Please try again.",
  ACTIVE_DELETION_REQUEST: "You already have an active deletion request.",
  UNEXPECTED_RESPONSE: "Unexpected response. Please try again.",
  FAILED_LOAD_PRIVACY: "Failed to load privacy settings.",
  FAILED_SAVE: "Failed to save.",
  FAILED_LOAD: "Failed to load.",
} as const;
