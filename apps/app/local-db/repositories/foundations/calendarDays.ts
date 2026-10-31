// Day-of-month and day-of-week checks shared by credit-card and income schedules.

export function isDayOfMonth(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 31;
}

export function isDayOfWeek(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0 && value <= 6;
}
