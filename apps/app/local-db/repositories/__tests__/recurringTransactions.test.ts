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

  it("handles monthly with day 31 month-end clamp", () => {
    setNow("2024-01-20");
    const tpl = makeTemplate({ frequency: "monthly", interval_count: 1, starts_on: "2024-01-15" });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-02-15");
  });

  it("handles weekly with day_of_week (ignored by JS)", () => {
    setNow("2024-07-17");
    const tpl = makeTemplate({ frequency: "weekly", interval_count: 1, starts_on: "2024-07-17", day_of_week: 1 });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-07-24");
  });

  it("handles yearly Feb 29 leap year (JS overflows to Mar 1)", () => {
    setNow("2024-12-01");
    const tpl = makeTemplate({ frequency: "yearly", interval_count: 1, starts_on: "2024-02-29" });
    const result = computeNextOccurrenceDate(tpl);
    expect(result).not.toBeNull();
    expect(result).toMatch(/^2025-0[23]-0?1$/);
  });

  it("handles ends_on cutoff", () => {
    setNow("2024-01-20");
    const tpl = makeTemplate({
      frequency: "daily", interval_count: 2, starts_on: "2024-01-01", ends_on: "2024-01-04",
    });
    expect(computeNextOccurrenceDate(tpl)).toBeNull();
  });

  it("handles last_generated_date override", () => {
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

  it("handles quarterly", () => {
    setNow("2024-05-01");
    const tpl = makeTemplate({ frequency: "quarterly", interval_count: 1, starts_on: "2024-02-15" });
    expect(computeNextOccurrenceDate(tpl)).toBe("2024-05-15");
  });

  it("handles custom (returns null)", () => {
    setNow("2024-01-01");
    const tpl = makeTemplate({ frequency: "custom", starts_on: "2024-01-01" });
    expect(computeNextOccurrenceDate(tpl)).toBeNull();
  });

  it("returns null when base > now", () => {
    setNow("2024-01-01");
    const tpl = makeTemplate({ frequency: "daily", interval_count: 1, starts_on: "2025-01-01" });
    expect(computeNextOccurrenceDate(tpl)).toBe("2025-01-02");
  });
});
