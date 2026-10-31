export function completedCalendarMonthRange(referenceDate = new Date()): { from: string; to: string } {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const from = new Date(Date.UTC(year, month - 6, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function calculateEmergencyFundBaseline(totalExpenseCentavos: number): number {
  return Math.round(totalExpenseCentavos / 6);
}
