export const FULL_YEAR_MONTHS: number;
export function historyWindow(expenseMonths: Iterable<string>, currentMonth: string): string[];
export function isFullYear(window: readonly string[]): boolean;
export function seasonalMonthSpend(input: { window: readonly string[]; monthly: ReadonlyMap<string, number>; recurring: number; targetMonth: string }): number;
