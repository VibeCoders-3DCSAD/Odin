import { jest } from "@jest/globals";

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
  type: { "": null },
}));
jest.mock("../../client", () => ({ initDatabase: jest.fn() }));
jest.mock("../../helpers", () => ({ enqueueOperation: jest.fn(), LocalDbError: class {} }));
jest.mock("../../uuid", () => ({ randomUUID: () => "00000000-0000-0000-0000-000000000000" }));

import { computeNextOccurrenceDate } from "../recurringTransactions";

type Template = Parameters<typeof computeNextOccurrenceDate>[0];

function makeTemplate(overrides: Partial<Template>): Template {
  return {
    id: "test-id",
    user_id: "user-id",
    transaction_type: "expense",
    status: "active",
    name: "test",
    amount_centavos: 1000,
    subcategory_id: null,
    source_account_id: null,
    destination_account_id: null,
    frequency: "monthly",
    interval_count: 1,
    day_of_month: null,
    second_day_of_month: null,
    day_of_week: null,
    custom_rule: "",
    starts_on: "2024-01-01",
    ends_on: null,
    next_occurrence_date: null,
    last_generated_date: null,
    reminder_enabled: 0,
    reminder_days_before: 0,
    notes: null,
    version: 1,
    deleted: 0,
    created_at: "",
    updated_at: "",
    last_synced_at: null,
    ...overrides,
  };
}

function setNow(dateStr: string): void {
  const d = new Date(dateStr + "T00:00:00Z");
  jest.useFakeTimers({ now: d.getTime() });
}

describe("computeNextOccurrenceDate", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("handles daily +2 interval", () => {
    setNow("2024-01-01");
    const tpl = makeTemplate({ frequency: "daily", interval_count: 2, starts_on: "2024-01-01" });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-01-03");
  });

  it("handles monthly day 31 month-end clamp", () => {
    setNow("2024-01-20");
    const tpl = makeTemplate({
      frequency: "monthly", interval_count: 1, starts_on: "2024-01-15", day_of_month: 31,
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-01-31");
  });

  it("handles weekly day_of_week", () => {
    setNow("2024-07-17");
    const tpl = makeTemplate({
      frequency: "weekly", interval_count: 1, starts_on: "2024-07-17", day_of_week: 1,
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-07-22");
  });

  it("handles yearly Feb 29 leap year fallback", () => {
    setNow("2025-02-01");
    const tpl = makeTemplate({ frequency: "yearly", interval_count: 1, starts_on: "2024-02-29" });
    expect(computeNextOccurrenceDate(tpl)).toBe("2025-02-28");
  });

  it("handles ends_on cutoff returning null", () => {
    setNow("2024-01-20");
    const tpl = makeTemplate({
      frequency: "daily", interval_count: 2, starts_on: "2024-01-01", ends_on: "2024-01-04",
    });
    expect(computeNextOccurrenceDate(tpl)).toBeNull();
  });

  it("honors last_generated_date over starts_on", () => {
    setNow("2024-01-20");
    const tpl = makeTemplate({
      frequency: "daily", interval_count: 1, starts_on: "2024-01-01", last_generated_date: "2024-01-15",
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-01-20");
  });

  it("handles ends_on exact boundary", () => {
    setNow("2024-01-05");
    const tpl = makeTemplate({
      frequency: "daily", interval_count: 1, starts_on: "2024-01-01", ends_on: "2024-01-05",
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-01-05");
  });

  it("handles quarterly day_of_month", () => {
    setNow("2024-04-15");
    const tpl = makeTemplate({
      frequency: "quarterly", interval_count: 1, starts_on: "2024-04-15", day_of_month: 31,
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-04-30");
  });

  it("handles quarterly day_of_month (next quarter)", () => {
    setNow("2024-04-30");
    const tpl = makeTemplate({
      frequency: "quarterly", interval_count: 1, starts_on: "2024-04-30", day_of_month: 31,
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-07-31");
  });

  it("handles custom frequency (returns null)", () => {
    setNow("2024-01-01");
    const tpl = makeTemplate({ frequency: "custom", starts_on: "2024-01-01" });
    expect(computeNextOccurrenceDate(tpl)).toBeNull();
  });

  it("returns null when starts_on is after today", () => {
    setNow("2024-01-01");
    const tpl = makeTemplate({ frequency: "daily", interval_count: 1, starts_on: "2024-06-01" });
    expect(computeNextOccurrenceDate(tpl)).toBeNull();
  });

  it("handles biweekly day_of_week", () => {
    setNow("2024-07-18");
    const tpl = makeTemplate({
      frequency: "biweekly", interval_count: 1, starts_on: "2024-07-17", day_of_week: 1,
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-07-22");
  });

  it("handles semi_monthly on 1st and 15th from Jan 10", () => {
    setNow("2024-01-10");
    const tpl = makeTemplate({
      frequency: "semi_monthly", interval_count: 1, starts_on: "2024-01-10",
      day_of_month: 1, second_day_of_month: 15,
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-01-15");
  });

  it("handles semi_monthly from Jan 16 (next month)", () => {
    setNow("2024-01-16");
    const tpl = makeTemplate({
      frequency: "semi_monthly", interval_count: 1, starts_on: "2024-01-16",
      day_of_month: 1, second_day_of_month: 15,
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-02-01");
  });

  it("handles monthly with both dom and sdom", () => {
    setNow("2024-01-10");
    const tpl = makeTemplate({
      frequency: "monthly", interval_count: 1, starts_on: "2024-01-10",
      day_of_month: 1, second_day_of_month: 15,
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-01-15");
  });

  it("handles yearly day_of_month", () => {
    setNow("2024-04-15");
    const tpl = makeTemplate({
      frequency: "yearly", interval_count: 1, starts_on: "2024-04-15", day_of_month: 31,
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-04-30");
  });

  it("handles monthly interval_count > 1 with day_of_month", () => {
    setNow("2024-01-20");
    const tpl = makeTemplate({
      frequency: "monthly", interval_count: 2, starts_on: "2024-01-15", day_of_month: 31,
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-01-31");
  });

  it("handles monthly interval_count > 1 already on target day", () => {
    setNow("2024-04-30");
    const tpl = makeTemplate({
      frequency: "monthly", interval_count: 2, starts_on: "2024-04-30", day_of_month: 31,
    });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-06-30");
  });

  it("computes initial next_occurrence_date from starts_on with day_of_month alignment", () => {
    const tpl = makeTemplate({
      frequency: "monthly", interval_count: 1, starts_on: "2024-01-15", day_of_month: 31,
    });
    const asOf = new Date("2024-01-15T00:00:00Z");
    expect(computeNextOccurrenceDate(tpl, asOf)).toBe("2024-01-31");
  });

  it("computes initial next_occurrence_date from starts_on with day_of_week alignment", () => {
    const tpl = makeTemplate({
      frequency: "weekly", interval_count: 1, starts_on: "2024-07-17", day_of_week: 1,
    });
    const asOf = new Date("2024-07-17T00:00:00Z");
    expect(computeNextOccurrenceDate(tpl, asOf)).toBe("2024-07-22");
  });

  it("computes initial next_occurrence_date with no alignment (starts_on + interval)", () => {
    const tpl = makeTemplate({
      frequency: "monthly", interval_count: 1, starts_on: "2024-01-15",
    });
    const asOf = new Date("2024-01-15T00:00:00Z");
    expect(computeNextOccurrenceDate(tpl, asOf)).toBe("2024-02-15");
  });
});
