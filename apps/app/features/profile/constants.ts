import type { FinancialProfileLabel } from "./types";

export const PROFILE_LABEL_DISPLAY: Record<FinancialProfileLabel, string> = {
  stable_flexible: "Stable-Flexible",
  stable_obligated: "Stable-Obligated",
  variable_flexible: "Variable-Flexible",
  variable_obligated: "Variable-Obligated",
};

export const PROFILE_LABEL_DESCRIPTIONS: Record<FinancialProfileLabel, string> = {
  stable_flexible:
    "You have steady income with few fixed expenses, giving you high flexibility to save and invest.",
  stable_obligated:
    "You have steady income but significant fixed obligations that limit your disposable cash.",
  variable_flexible:
    "Your income varies but your obligations are low, giving you flexibility when cash flow is good.",
  variable_obligated:
    "Both your income and obligations are unpredictable — careful cash flow management is essential.",
};

export const PROFILE_ERRORS = {
  fetch_failed: "Failed to load profile assignment.",
  confirm_failed: "Failed to confirm profile assignment.",
  reject_failed: "Failed to reject profile assignment.",
  select_failed: "Failed to select profile.",
  reassess_failed: "Failed to request reassessment.",
  generic: "Something went wrong. Please try again.",
} as const;
