import { normalizeRecurrenceMonths, recurringMonthSpend, resolveRecurringPayments } from "@odin/spending-insights/recurringMonths.js";

const payment = (transactionDate: string, amountCentavos: number, months: number[] | null, key = "tuition") => ({ key, transactionDate, amountCentavos, months });

describe("recurring months", () => {
  it("accepts distinct months from 1 to 12 and sorts them", () => {
    expect(normalizeRecurrenceMonths([11, 6])).toEqual([6, 11]);
    for (const invalid of [[], [0], [13], [6, 6], [6.5], ["6"], "6", null]) expect(normalizeRecurrenceMonths(invalid)).toBeNull();
  });

  it("expects a payment in each chosen month for the year after it", () => {
    const resolved = resolveRecurringPayments([payment("2026-06-10", 50_000, [6, 11])]);
    expect(recurringMonthSpend(resolved, "2026-06")).toBe(0);
    expect(recurringMonthSpend(resolved, "2026-11")).toBe(50_000);
    expect(recurringMonthSpend(resolved, "2026-12")).toBe(0);
    expect(recurringMonthSpend(resolved, "2027-06")).toBe(50_000);
    expect(recurringMonthSpend(resolved, "2027-11")).toBe(0);
  });

  it("keeps a payment without chosen months in its own month", () => {
    const resolved = resolveRecurringPayments([payment("2025-11-20", 25_000, null)]);
    expect(recurringMonthSpend(resolved, "2026-11")).toBe(25_000);
    expect(recurringMonthSpend(resolved, "2026-10")).toBe(0);
  });

  it("lets the newest payment stand for the months it shares with older ones", () => {
    const resolved = resolveRecurringPayments([payment("2026-06-10", 50_000, [6, 11]), payment("2026-11-09", 52_000, [6, 11])]);
    expect(resolved).toEqual([payment("2026-11-09", 52_000, [6, 11])]);
    expect(recurringMonthSpend(resolved, "2027-06")).toBe(52_000);
  });

  it("adds payments for different subcategories in the same month", () => {
    const resolved = resolveRecurringPayments([payment("2026-03-01", 10_000, [3], "insurance"), payment("2026-03-05", 7_000, [3], "registration")]);
    expect(recurringMonthSpend(resolved, "2027-03")).toBe(17_000);
  });
});
