import type { IncomeFrequency, IncomeSource } from "../../local-db/repositories/financialFoundations";

export const FREQUENCIES: readonly IncomeFrequency[] = ["monthly", "semi_monthly", "weekly", "daily"];

export const FREQUENCY_LABELS: Record<IncomeFrequency, string> = { monthly: "Monthly", semi_monthly: "Twice a month", weekly: "Every week", daily: "Every day" };

export function formatIncomeAmount(centavos: number): string {
  return (centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function incomeScheduleLabel(source: IncomeSource): string {
  const { frequency, paydayDayOfMonth: first, paydaySecondDayOfMonth: second, paydayDayOfWeek: weekday } = source;
  if (frequency === "monthly" && first != null) return `Monthly · day ${first}`;
  if (frequency === "semi_monthly" && first != null && second != null) return `Twice a month · ${first} and ${second}`;
  if (frequency === "weekly" && weekday != null) {
    const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday];
    if (day) return `Every ${day}`;
  }
  return FREQUENCY_LABELS[frequency];
}
