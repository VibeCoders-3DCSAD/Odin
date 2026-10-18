import type { IncomeFrequency } from "../../local-db/repositories/financialFoundations";

export const FREQUENCIES: readonly IncomeFrequency[] = ["monthly", "semi_monthly", "weekly", "daily"];

export const FREQUENCY_LABELS: Record<IncomeFrequency, string> = { monthly: "Monthly", semi_monthly: "Twice a month", weekly: "Every week", daily: "Every day" };
