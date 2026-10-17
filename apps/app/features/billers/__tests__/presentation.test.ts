import { dueLabel, dueThisMonthCentavos, formatDueDate, formatPhp, isDueSoon, ordinal, rowSubtitle, scheduleLabel } from "../presentation";
import type { Occurrence, PaymentSchedule } from "../schedule";

const monthly: PaymentSchedule = { frequency: "monthly", dueDayOfMonth: 1, dueSecondDayOfMonth: null, dueDayOfWeek: null, dueMonth: null, startsOn: "2026-09-01", endsOn: null };
const occurrence = (dueDate: string, status: Occurrence["status"] = "upcoming"): Occurrence => ({ dueDate, status, scheduledCentavos: 100, paidCentavos: 0, remainingCentavos: 100 });

it("formats pesos, ordinals and due dates as the V4 screens print them", () => {
  expect(formatPhp(1_758_900)).toBe("PHP 17,589.00");
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 30].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "30th"]);
  expect(formatDueDate("2026-09-05")).toBe("Sep 5 2026");
});

it("labels each schedule", () => {
  expect(scheduleLabel(monthly)).toBe("1st");
  expect(scheduleLabel({ ...monthly, frequency: "weekly", dueDayOfWeek: 5 })).toBe("Every Friday");
  expect(scheduleLabel({ ...monthly, frequency: "semi_monthly", dueDayOfMonth: 30, dueSecondDayOfMonth: 15 })).toBe("15th & 30th");
  expect(scheduleLabel({ ...monthly, frequency: "yearly", dueDayOfMonth: 15, dueMonth: 1 })).toBe("Jan 15");
  expect(scheduleLabel({ ...monthly, frequency: "once", startsOn: "2026-09-30" })).toBe("Sep 30 2026");
});

it("shows the due date only when it is close or needs attention", () => {
  expect(dueLabel(occurrence("2026-10-20"), "2026-10-17")).toBe("Due in 3 days");
  expect(dueLabel(occurrence("2026-10-18"), "2026-10-17")).toBe("Due tomorrow");
  expect(dueLabel(occurrence("2026-10-21"), "2026-10-17")).toBeNull();
  expect(dueLabel(occurrence("2026-10-01", "overdue"), "2026-10-17")).toBe("Overdue");
});

it("builds list subtitles like the design rows", () => {
  expect(rowSubtitle("Housing", { ...monthly, autoPost: true }, occurrence("2026-11-01"), "2026-10-17")).toBe("Housing · 1st · Auto-post");
  expect(rowSubtitle("Government", { ...monthly, dueDayOfMonth: 20, autoPost: false }, occurrence("2026-10-20"), "2026-10-17")).toBe("Government · Due in 3 days");
});

it("treats overdue and the next three days as due soon", () => {
  expect(isDueSoon(occurrence("2026-10-01", "overdue"), "2026-10-17")).toBe(true);
  expect(isDueSoon(occurrence("2026-10-20"), "2026-10-17")).toBe(true);
  expect(isDueSoon(occurrence("2026-10-21"), "2026-10-17")).toBe(false);
  expect(isDueSoon(null, "2026-10-17")).toBe(false);
});

it("totals every due date in the current month", () => {
  const weekly = { ...monthly, frequency: "weekly" as const, dueDayOfWeek: 5, amountCentavos: 100 };
  // October 2026 has five Fridays.
  expect(dueThisMonthCentavos([{ ...monthly, amountCentavos: 1_200_000 }, weekly], "2026-10-17")).toBe(1_200_000 + 500);
});
