import { currentOccurrence, dueDatesBetween, nextDueDate, occurrenceStatus, previousDueDate, type PaymentSchedule } from "../schedule";

const base: PaymentSchedule = { frequency: "monthly", dueDayOfMonth: 5, dueSecondDayOfMonth: null, dueDayOfWeek: null, dueMonth: null, startsOn: "2026-09-01", endsOn: null };

describe("dueDatesBetween", () => {
  it("clamps monthly due days to short months", () => {
    expect(dueDatesBetween({ ...base, dueDayOfMonth: 31 }, "2026-09-01", "2026-12-31")).toEqual(["2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31"]);
  });

  it("returns both semi-monthly days in order", () => {
    expect(dueDatesBetween({ ...base, frequency: "semi_monthly", dueDayOfMonth: 30, dueSecondDayOfMonth: 15 }, "2027-02-01", "2027-03-20")).toEqual(["2027-02-15", "2027-02-28", "2027-03-15"]);
  });

  it("repeats weekly and every two weeks from the first matching weekday", () => {
    // 2026-09-01 is a Tuesday; 5 is Friday.
    expect(dueDatesBetween({ ...base, frequency: "weekly", dueDayOfWeek: 5 }, "2026-09-01", "2026-09-20")).toEqual(["2026-09-04", "2026-09-11", "2026-09-18"]);
    expect(dueDatesBetween({ ...base, frequency: "biweekly", dueDayOfWeek: 5 }, "2026-09-10", "2026-10-10")).toEqual(["2026-09-18", "2026-10-02"]);
  });

  it("anchors quarterly payments to the start month and yearly payments to their due month", () => {
    expect(dueDatesBetween({ ...base, frequency: "quarterly", dueDayOfMonth: 20 }, "2026-09-01", "2027-06-30")).toEqual(["2026-09-20", "2026-12-20", "2027-03-20", "2027-06-20"]);
    expect(dueDatesBetween({ ...base, frequency: "yearly", dueDayOfMonth: 29, dueMonth: 2 }, "2026-09-01", "2028-12-31")).toEqual(["2027-02-28", "2028-02-29"]);
  });

  it("skips due dates before the start and after the end", () => {
    expect(dueDatesBetween({ ...base, startsOn: "2026-09-10", endsOn: "2026-11-04" }, "2026-08-01", "2026-12-31")).toEqual(["2026-10-05"]);
  });

  it("returns a one-time payment only when its date is in range", () => {
    const once: PaymentSchedule = { ...base, frequency: "once", dueDayOfMonth: null, startsOn: "2026-09-30" };
    expect(dueDatesBetween(once, "2026-09-01", "2026-09-30")).toEqual(["2026-09-30"]);
    expect(dueDatesBetween(once, "2026-10-01", "2026-12-31")).toEqual([]);
  });
});

describe("next and previous due dates", () => {
  it("includes the boundary day", () => {
    expect(nextDueDate(base, "2026-10-05")).toBe("2026-10-05");
    expect(previousDueDate(base, "2026-10-04")).toBe("2026-09-05");
  });

  it("finds a yearly due date almost a year away", () => {
    expect(nextDueDate({ ...base, frequency: "yearly", dueMonth: 9 }, "2026-09-06")).toBe("2027-09-05");
  });
});

describe("occurrenceStatus", () => {
  it("prefers paid, then overdue, then partially paid", () => {
    expect(occurrenceStatus(1000, 1000, "2026-10-01", "2026-10-17")).toBe("paid");
    expect(occurrenceStatus(1000, 400, "2026-10-01", "2026-10-17")).toBe("overdue");
    expect(occurrenceStatus(1000, 400, "2026-10-17", "2026-10-17")).toBe("partially_paid");
    expect(occurrenceStatus(1000, 0, "2026-10-20", "2026-10-17")).toBe("upcoming");
  });
});

describe("currentOccurrence", () => {
  it("keeps an unpaid past occurrence current until it is paid", () => {
    expect(currentOccurrence(base, 1000, new Map([["2026-10-05", 300]]), "2026-10-17")).toEqual({ dueDate: "2026-10-05", scheduledCentavos: 1000, paidCentavos: 300, remainingCentavos: 700, status: "overdue" });
  });

  it("moves to the next due date once the past one is paid", () => {
    expect(currentOccurrence(base, 1000, new Map([["2026-10-05", 1000]]), "2026-10-17")).toMatchObject({ dueDate: "2026-11-05", status: "upcoming", remainingCentavos: 1000 });
  });

  it("treats today's due date as current, not overdue", () => {
    expect(currentOccurrence(base, 1000, new Map([["2026-09-05", 1000]]), "2026-10-05")).toMatchObject({ dueDate: "2026-10-05", status: "upcoming" });
  });

  it("returns null after the schedule has ended and been paid", () => {
    expect(currentOccurrence({ ...base, endsOn: "2026-09-30" }, 1000, new Map([["2026-09-05", 1000]]), "2026-10-17")).toBeNull();
  });
});
