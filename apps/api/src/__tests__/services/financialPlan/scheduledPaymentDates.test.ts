import { scheduledPaymentDueDates, scheduledPaymentReservations, type ScheduledPaymentRow } from "../../../services/financialPlan/scheduledPaymentDates";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { dueDatesBetween } = require("../../../../../../apps/app/features/billers/schedule");

const base: ScheduledPaymentRow = { id: "rent", amount_centavos: 1_200_000, frequency: "monthly", due_day_of_month: 1, due_second_day_of_month: null, due_day_of_week: null, due_month: null, starts_on: "2026-09-01", ends_on: null };

const schedules: ScheduledPaymentRow[] = [
  base,
  { ...base, due_day_of_month: 31 },
  { ...base, frequency: "semi_monthly", due_day_of_month: 30, due_second_day_of_month: 15 },
  { ...base, frequency: "daily", due_day_of_month: null, starts_on: "2026-12-28", ends_on: "2027-01-03" },
  { ...base, frequency: "weekly", due_day_of_week: 5 },
  { ...base, frequency: "biweekly", due_day_of_week: 0, starts_on: "2026-09-10" },
  { ...base, frequency: "quarterly", due_day_of_month: 20 },
  { ...base, frequency: "yearly", due_day_of_month: 29, due_month: 2 },
  { ...base, frequency: "once", starts_on: "2027-01-15" },
  { ...base, ends_on: "2026-12-31" },
];

describe("scheduledPaymentDueDates", () => {
  it.each(schedules.map((schedule, index) => [index, schedule] as const))("matches the app's due dates for schedule %i", (_index, schedule) => {
    const app = dueDatesBetween({
      frequency: schedule.frequency, dueDayOfMonth: schedule.due_day_of_month, dueSecondDayOfMonth: schedule.due_second_day_of_month,
      dueDayOfWeek: schedule.due_day_of_week, dueMonth: schedule.due_month, startsOn: schedule.starts_on, endsOn: schedule.ends_on,
    }, "2026-08-01", "2028-03-31");
    expect(scheduledPaymentDueDates(schedule, "2026-08-01", "2028-03-31")).toEqual(app);
  });
});

describe("scheduledPaymentReservations", () => {
  it("reserves every due date in the month at its full amount", () => {
    const weekly = { ...base, id: "sss", amount_centavos: 10_000, frequency: "weekly" as const, due_day_of_week: 5 };
    const reservations = scheduledPaymentReservations([base, weekly], { start: "2026-10-01", end: "2026-10-31" });

    expect(reservations).toEqual([
      { scheduledPaymentId: "rent", amountCentavos: base.amount_centavos, dueDate: "2026-10-01" },
      ...["2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"].map((dueDate) => ({ scheduledPaymentId: "sss", amountCentavos: 10_000, dueDate })),
    ]);
  });
});
