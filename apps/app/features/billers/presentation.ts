import { addDays, dueDatesBetween, type Occurrence, type PaymentSchedule, type ScheduledPaymentFrequency } from "./schedule";

export const FREQUENCY_LABELS: Record<ScheduledPaymentFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  semi_monthly: "Twice a month",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  once: "None",
};

// The choices the form offers, matching savings goal contributions. Every 2 weeks, quarterly and yearly
// are no longer offered but still schedule correctly for payments saved with them.
export const FREQUENCY_OPTIONS = (["daily", "weekly", "semi_monthly", "monthly", "once"] as const).map((key) => ({ key, label: FREQUENCY_LABELS[key] }));

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

// Days ahead that count as "due soon", matching the list filter's copy.
export const DUE_SOON_DAYS = 3;

export function formatPhp(centavos: number): string {
  return `PHP ${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ordinal(day: number): string {
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
  return `${day}${suffix}`;
}

// "Sep 5 2026", as the V4 form prints next and last post dates.
export function formatDueDate(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))} ${date.slice(0, 4)}`;
}

export function scheduleLabel(schedule: PaymentSchedule): string {
  const day = schedule.dueDayOfMonth;
  const weekday = schedule.dueDayOfWeek != null ? WEEKDAY_NAMES[schedule.dueDayOfWeek] : null;
  switch (schedule.frequency) {
    case "daily": return "Daily";
    case "weekly": return weekday ? `Every ${weekday}` : "Weekly";
    case "biweekly": return weekday ? `Every other ${weekday}` : "Every 2 weeks";
    case "semi_monthly": return day != null && schedule.dueSecondDayOfMonth != null ? `${ordinal(Math.min(day, schedule.dueSecondDayOfMonth))} & ${ordinal(Math.max(day, schedule.dueSecondDayOfMonth))}` : "Twice a month";
    case "monthly": return day != null ? ordinal(day) : "Monthly";
    case "quarterly": return day != null ? `Quarterly · ${ordinal(day)}` : "Quarterly";
    case "yearly": return day != null && schedule.dueMonth != null ? `${MONTHS[schedule.dueMonth - 1]} ${day}` : "Yearly";
    case "once": return formatDueDate(schedule.startsOn);
  }
}

export function repeatsLabel(frequency: ScheduledPaymentFrequency): string {
  return frequency === "once" ? "Does not repeat" : `Repeats ${FREQUENCY_LABELS[frequency].toLowerCase()}`;
}

export function dueLabel(current: Occurrence | null, today: string): string | null {
  if (!current) return null;
  if (current.status === "overdue") return "Overdue";
  if (current.status === "paid") return "Paid";
  if (current.status === "partially_paid") return "Partially paid";
  if (current.dueDate === today) return "Due today";
  if (current.dueDate === addDays(today, 1)) return "Due tomorrow";
  for (let days = 2; days <= DUE_SOON_DAYS; days++) if (current.dueDate === addDays(today, days)) return `Due in ${days} days`;
  return null;
}

export function rowSubtitle(categoryLabel: string, payment: PaymentSchedule & { autoPost: boolean }, current: Occurrence | null, today: string): string {
  return [categoryLabel, dueLabel(current, today) ?? (current ? scheduleLabel(payment) : "Ended"), payment.autoPost ? "Auto-post" : null].filter(Boolean).join(" · ");
}

export function isDueSoon(current: Occurrence | null, today: string): boolean {
  return Boolean(current && current.status !== "paid" && current.dueDate <= addDays(today, DUE_SOON_DAYS));
}

// Scheduled total for every due date in the calendar month containing today.
export function dueThisMonthCentavos(payments: (PaymentSchedule & { amountCentavos: number })[], today: string): number {
  const monthStart = `${today.slice(0, 8)}01`;
  const monthEnd = addDays(`${addDays(monthStart, 32).slice(0, 8)}01`, -1);
  return payments.reduce((total, payment) => total + dueDatesBetween(payment, monthStart, monthEnd).length * payment.amountCentavos, 0);
}
