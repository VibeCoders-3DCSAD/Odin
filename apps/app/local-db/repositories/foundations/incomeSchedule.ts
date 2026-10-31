import { LocalDbError } from "../../helpers";
import { isDayOfMonth, isDayOfWeek } from "./calendarDays";
import type { IncomeFrequency } from "./incomeSourceModel";

export type IncomeSchedule = {
  frequency: IncomeFrequency;
  paydayDayOfMonth: number | null;
  paydaySecondDayOfMonth: number | null;
  paydayDayOfWeek: number | null;
};

export const VALID_INCOME_FREQUENCIES: IncomeFrequency[] = ["daily", "weekly", "semi_monthly", "monthly"];

// Days past a month's end fall back to its last day. Twice-a-month paydays must still differ in
// February, when every day past the 28th becomes the 28th.
export function incomeScheduleError(schedule: IncomeSchedule): string | null {
  const { frequency, paydayDayOfMonth: day1, paydaySecondDayOfMonth: day2 } = schedule;
  if (frequency === "monthly" && (day1 === null || !isDayOfMonth(day1))) return "Enter a payday from 1 to 31.";
  if (frequency === "semi_monthly") {
    if (day1 === null || day2 === null || !isDayOfMonth(day1) || !isDayOfMonth(day2)) return "Enter Date 1 and Date 2, each from 1 to 31.";
    if (day1 >= day2) return "Date 1 must come before Date 2.";
    if (day1 >= Math.min(day2, 28)) return "Date 1 must be the 27th or earlier when Date 2 is after the 28th, so February still has two paydays.";
  }
  if (frequency === "weekly" && !isDayOfWeek(schedule.paydayDayOfWeek)) return "Select the payday of the week.";
  return null;
}

// Keeps only the payday fields the frequency uses.
export function normalizeIncomeSchedule(schedule: IncomeSchedule): IncomeSchedule {
  const usesDayOfMonth = schedule.frequency === "monthly" || schedule.frequency === "semi_monthly";
  return {
    frequency: schedule.frequency,
    paydayDayOfMonth: usesDayOfMonth ? schedule.paydayDayOfMonth : null,
    paydaySecondDayOfMonth: schedule.frequency === "semi_monthly" ? schedule.paydaySecondDayOfMonth : null,
    paydayDayOfWeek: schedule.frequency === "weekly" ? schedule.paydayDayOfWeek : null,
  };
}

export function assertIncomeSchedule(schedule: IncomeSchedule): void {
  if (!VALID_INCOME_FREQUENCIES.includes(schedule.frequency)) {
    throw new LocalDbError("VALIDATION_ERROR", `frequency must be one of: ${VALID_INCOME_FREQUENCIES.join(", ")}`);
  }
  const error = incomeScheduleError(schedule);
  if (error) throw new LocalDbError("VALIDATION_ERROR", error);
}

export function assertIncomeAmount(amount: number | undefined): void {
  if (amount === undefined || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new LocalDbError("VALIDATION_ERROR", "Enter an expected income greater than zero.");
  }
}
