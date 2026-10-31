import type { FinancialAccountKind } from "../../../local-db/repositories/foundations/financialFoundations";
import { parseDayOfMonth, parseSafeCents } from "./accountFormParsing";

export type FieldErrors = Partial<Record<"name" | "openingBalance" | "creditLimit" | "cutoffDay" | "threshold", string>>;

export type AccountFormValues = {
  name: string;
  kind: FinancialAccountKind;
  openingBalance: string;
  creditLimit: string;
  cutoffDay: string;
  threshold: string;
};

export type AccountFormValidation = {
  errors: FieldErrors;
  openingCents: number | null;
  limitCents: number | null;
  cutoffDayValue: number | null;
  thresholdValue: number | null;
};

export function validateAccountForm({ name, kind, openingBalance, creditLimit, cutoffDay, threshold }: AccountFormValues): AccountFormValidation {
  const errors: FieldErrors = {};

  const openingCents = parseSafeCents(openingBalance);
  if (!name.trim()) errors.name = "Account name is required.";
  if (openingBalance.trim() && openingCents === null) errors.openingBalance = kind === "credit_card" ? "Outstanding balance must be a valid amount." : "Opening balance must be a valid amount.";

  let limitCents: number | null = null;
  let thresholdValue: number | null = null;
  let cutoffDayValue: number | null = null;

  if (kind === "credit_card") {
    if (!creditLimit.trim()) {
      errors.creditLimit = "Credit limit is required.";
    } else {
      limitCents = parseSafeCents(creditLimit);
      if (limitCents === null) errors.creditLimit = "Credit limit must be a valid amount.";
      else if (limitCents <= 0) errors.creditLimit = "Credit limit must be greater than 0.";
    }

    cutoffDayValue = parseDayOfMonth(cutoffDay);
    if (!cutoffDay.trim()) errors.cutoffDay = "Enter a valid cut-off day.";
    else if (cutoffDayValue === null) errors.cutoffDay = "Enter a valid cut-off day.";

    if (!threshold.trim()) {
      errors.threshold = "Alert threshold is required.";
    } else if (!/^\d+$/.test(threshold.trim())) {
      errors.threshold = "Alert threshold must be between 0 and 100.";
    } else {
      thresholdValue = parseInt(threshold.trim(), 10);
      if (thresholdValue < 0 || thresholdValue > 100) errors.threshold = "Alert threshold must be between 0 and 100.";
    }
  }

  return { errors, openingCents, limitCents, cutoffDayValue, thresholdValue };
}
