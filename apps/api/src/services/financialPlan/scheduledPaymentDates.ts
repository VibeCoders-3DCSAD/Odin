// Port of dueDatesBetween in apps/app/features/billers/schedule.ts; the parity test keeps the two in step.

export type ScheduledPaymentRow = {
  id: string;
  amount_centavos: number;
  frequency: "daily" | "weekly" | "biweekly" | "semi_monthly" | "monthly" | "quarterly" | "yearly" | "once";
  due_day_of_month: number | null;
  due_second_day_of_month: number | null;
  due_day_of_week: number | null;
  due_month: number | null;
  starts_on: string;
  ends_on: string | null;
};

const DAY_MS = 86_400_000;

function toTime(date: string): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
}

function toDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function monthDay(year: number, monthIndex: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return toDate(Date.UTC(year, monthIndex, Math.min(day, lastDay)));
}

function monthlyDays(payment: ScheduledPaymentRow, year: number, monthIndex: number): string[] {
  const day = payment.due_day_of_month;
  if (day == null) return [];
  const startMonth = Number(payment.starts_on.slice(5, 7)) - 1;
  switch (payment.frequency) {
    case "monthly": return [monthDay(year, monthIndex, day)];
    case "semi_monthly": return payment.due_second_day_of_month == null ? [] : [day, payment.due_second_day_of_month].sort((a, b) => a - b).map((d) => monthDay(year, monthIndex, d));
    case "quarterly": return (((monthIndex - startMonth) % 3) + 3) % 3 === 0 ? [monthDay(year, monthIndex, day)] : [];
    case "yearly": return payment.due_month === monthIndex + 1 ? [monthDay(year, monthIndex, day)] : [];
    default: return [];
  }
}

export function scheduledPaymentDueDates(payment: ScheduledPaymentRow, from: string, to: string): string[] {
  const start = from > payment.starts_on ? from : payment.starts_on;
  const end = payment.ends_on && payment.ends_on < to ? payment.ends_on : to;
  if (start > end) return [];
  if (payment.frequency === "once") return payment.starts_on >= start && payment.starts_on <= end ? [payment.starts_on] : [];
  if (payment.frequency === "daily") {
    const dates: string[] = [];
    for (let time = toTime(start); time <= toTime(end); time += DAY_MS) dates.push(toDate(time));
    return dates;
  }
  if (payment.frequency === "weekly" || payment.frequency === "biweekly") {
    if (payment.due_day_of_week == null) return [];
    const step = (payment.frequency === "weekly" ? 7 : 14) * DAY_MS;
    const startTime = toTime(payment.starts_on);
    let time = startTime + (((payment.due_day_of_week - new Date(startTime).getUTCDay()) + 7) % 7) * DAY_MS;
    if (time < toTime(start)) time += Math.ceil((toTime(start) - time) / step) * step;
    const dates: string[] = [];
    for (; time <= toTime(end); time += step) dates.push(toDate(time));
    return dates;
  }
  const dates: string[] = [];
  let year = Number(start.slice(0, 4));
  let monthIndex = Number(start.slice(5, 7)) - 1;
  while (monthDay(year, monthIndex, 1) <= end) {
    dates.push(...monthlyDays(payment, year, monthIndex).filter((date) => date >= start && date <= end));
    monthIndex += 1;
    if (monthIndex === 12) { monthIndex = 0; year += 1; }
  }
  return dates;
}

// Each due date in the period still owes its scheduled amount less what was already paid against it.
export function scheduledPaymentReservations(payments: ScheduledPaymentRow[], paid: { scheduled_payment_id: string; occurrence_date: string; amount_centavos: number }[], period: { start: string; end: string }) {
  const paidByOccurrence = new Map<string, number>();
  for (const record of paid) {
    const key = `${record.scheduled_payment_id}:${record.occurrence_date}`;
    paidByOccurrence.set(key, (paidByOccurrence.get(key) ?? 0) + record.amount_centavos);
  }
  return payments.flatMap((payment) => scheduledPaymentDueDates(payment, period.start, period.end).flatMap((dueDate) => {
    const amountCentavos = Math.max(payment.amount_centavos - (paidByOccurrence.get(`${payment.id}:${dueDate}`) ?? 0), 0);
    return amountCentavos > 0 ? [{ scheduledPaymentId: payment.id, amountCentavos, dueDate }] : [];
  }));
}
