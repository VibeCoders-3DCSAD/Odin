import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
const mockListUnusualSpendings = jest.fn<(...args: any[]) => any>();
const mockListSavedRecurrences = jest.fn<(...args: any[]) => any>();
jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));
jest.mock("../unusualSpending", () => ({
  listUnusualSpendings: (...args: unknown[]) => mockListUnusualSpendings(...args),
  listSavedRecurrences: (...args: unknown[]) => mockListSavedRecurrences(...args),
}));

describe("listForecastTransactions", () => {
  beforeEach(() => { jest.resetModules(); mockInitDatabase.mockReset(); });

  it("reads only the current user's posted income and expenses with their purpose-level category slugs", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([{ id: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be", transaction_date: "2026-09-04", amount_centavos: 24550, transaction_type: "expense", merchant_name: "Market", counterparty_name: null, notes: null, category_slug: "food" }]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { listForecastTransactions } = await import("../forecastTransactions");
    await expect(listForecastTransactions("user-1")).resolves.toEqual([{ transactionId: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be", date: "2026-09-04", amount: 245.5, category: "food", transactionType: "expense", description: "Market" }]);
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining("t.user_id = ? AND t.deleted = 0 AND t.status = 'posted'"), "user-1");
    expect(getAllAsync.mock.calls[0]![0]).toContain("t.transaction_type IN ('income', 'expense')");
    expect(getAllAsync.mock.calls[0]![0]).not.toContain("category_groups");
    expect(getAllAsync.mock.calls[0]![0]).toContain("COALESCE(c.slug, 'Other') AS category_slug");
    expect(getAllAsync.mock.calls[0]![0]).toContain("SELECT t.id, t.transaction_date, t.amount_centavos");
    expect(getAllAsync.mock.calls[0]![0]).not.toContain("GROUP BY");
    expect(getAllAsync.mock.calls[0]![0]).toContain("ORDER BY t.transaction_date DESC");
  });

  it("bounds history from the requested date", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { listForecastTransactions } = await import("../forecastTransactions");
    await listForecastTransactions("user-1", { fromDate: "2025-09-15" });
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining("t.transaction_date >= ?"), "user-1", "2025-09-15");
  });

  it("leaves out biller and remittance payments only when asked", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { listForecastTransactions } = await import("../forecastTransactions");
    await listForecastTransactions("user-1", { fromDate: "2025-10-01", excludeScheduledPayments: true });
    await listForecastTransactions("user-1", { fromDate: "2025-10-01" });
    expect(getAllAsync.mock.calls[0]![0]).toContain("NOT EXISTS (SELECT 1 FROM scheduled_payment_records r");
    expect(getAllAsync.mock.calls[1]![0]).not.toContain("scheduled_payment_records");
  });

  it("leaves out unanswered and one-time unusual spending only when asked, and tags yearly payments from saved answers", async () => {
    const row = (id: string) => ({ id, transaction_date: "2026-03-06", amount_centavos: 4_200_000, transaction_type: "expense", merchant_name: null, counterparty_name: null, notes: null, category_slug: "communication" });
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockImplementation(async () => [row("tuition"), row("gift"), row("laptop"), row("phone"), row("confirmed")]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    // The check flags the laptop and gift; the tuition is no longer flagged but keeps its saved yearly answer.
    mockListUnusualSpendings.mockResolvedValue([{ transactionId: "laptop" }, { transactionId: "gift" }, { transactionId: "confirmed" }]);
    mockListSavedRecurrences.mockResolvedValue(new Map([["gift", "one_time"], ["confirmed", "frequent"], ["tuition", "yearly"]]));
    const { listForecastTransactions } = await import("../forecastTransactions");
    const list = (excludeUnusualSpending: boolean) => listForecastTransactions("user-1", { excludeUnusualSpending });
    const kept = await list(true);
    expect(kept.map((item) => [item.transactionId, item.recurrence])).toEqual([["confirmed", undefined], ["phone", undefined], ["tuition", "yearly"]]);
    await expect(list(false).then((items) => items.map((item) => item.transactionId))).resolves.toEqual(["confirmed", "phone", "laptop", "gift", "tuition"]);
  });

  it("lists the quarters before the current one, oldest first", async () => {
    const { pastQuarters } = await import("../forecastTransactions");
    expect(pastQuarters(8, new Date("2026-10-21T00:00:00Z"))).toEqual(["2024Q4", "2025Q1", "2025Q2", "2025Q3", "2025Q4", "2026Q1", "2026Q2", "2026Q3"]);
    expect(pastQuarters(1, new Date("2027-01-05T00:00:00Z"))).toEqual(["2026Q4"]);
  });

  it("sums actual expenses per quarter and category, with billers in their own group", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([
      { period: "2025Q4", category: "food", amount_centavos: 900_000 },
      { period: "2025Q4", category: "billers_remittances", amount_centavos: 10_800_000 },
      { period: "2026Q1", category: "food", amount_centavos: 1_000_000 },
    ]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { listQuarterlySpending } = await import("../forecastTransactions");

    await expect(listQuarterlySpending("user-1", ["2025Q4", "2026Q1", "2026Q2"])).resolves.toEqual([
      { quarter: "2025Q4", totalCentavos: 11_700_000, categories: [{ category: "food", amountCentavos: 900_000 }, { category: "billers_remittances", amountCentavos: 10_800_000 }] },
      { quarter: "2026Q1", totalCentavos: 1_000_000, categories: [{ category: "food", amountCentavos: 1_000_000 }] },
      { quarter: "2026Q2", totalCentavos: 0, categories: [] },
    ]);
    const [sql, ...params] = getAllAsync.mock.calls[0]!;
    expect(sql).toContain("THEN 'billers_remittances' ELSE c.slug END");
    expect(sql).toContain("t.transaction_type = 'expense'");
    expect(params).toEqual(["user-1", "2025-10-01", "2026-06-30"]);
  });

  it("lists the two months before this one and this month, oldest first", async () => {
    const { recentMonths } = await import("../forecastTransactions");
    expect(recentMonths(3, new Date("2026-10-25T00:00:00Z"))).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(recentMonths(3, new Date("2027-01-05T00:00:00Z"))).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("starts a new month and quarter at midnight Philippine time", async () => {
    const { getForecastHistoryStartDate, pastQuarters, recentMonths } = await import("../forecastTransactions");
    // 1 AM on November 1 in Manila is still October 31 in UTC.
    expect(recentMonths(3, new Date("2026-10-31T17:00:00Z"))).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(getForecastHistoryStartDate(new Date("2026-10-31T17:00:00Z"))).toBe("2025-11-01");
    expect(pastQuarters(1, new Date("2026-12-31T16:30:00Z"))).toEqual(["2026Q4"]);
  });

  it("sums actual expenses per month and category, through the end of the last month", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([
      { period: "2026-08", category: "food", amount_centavos: 300_000 },
      { period: "2026-10", category: "billers_remittances", amount_centavos: 150_000 },
    ]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { listMonthlySpending } = await import("../forecastTransactions");

    await expect(listMonthlySpending("user-1", ["2026-08", "2026-09", "2026-10"])).resolves.toEqual([
      { month: "2026-08", totalCentavos: 300_000, categories: [{ category: "food", amountCentavos: 300_000 }] },
      { month: "2026-09", totalCentavos: 0, categories: [] },
      { month: "2026-10", totalCentavos: 150_000, categories: [{ category: "billers_remittances", amountCentavos: 150_000 }] },
    ]);
    const [sql, ...params] = getAllAsync.mock.calls[0]!;
    expect(sql).toContain("substr(t.transaction_date, 1, 7) AS period");
    expect(params).toEqual(["user-1", "2026-08-01", "2026-10-31"]);
  });

  it("does not send malformed or zero-value local rows", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([{ id: "bad", transaction_date: "2026-09-04", amount_centavos: 0, transaction_type: "expense", merchant_name: null, counterparty_name: null, notes: null, category_slug: null }]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { listForecastTransactions } = await import("../forecastTransactions");
    await expect(listForecastTransactions("user-1")).resolves.toEqual([]);
  });

  it("uses the previous twelve calendar months plus the current month", async () => {
    const { getForecastHistoryStartDate } = await import("../forecastTransactions");

    expect(getForecastHistoryStartDate(new Date("2026-09-15T12:00:00Z"))).toBe("2025-09-01");
  });

  it("returns only recent posted expense subcategories for plan recommendations", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([{ subcategory_id: "groceries" }, { subcategory_id: "transport" }]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { listRecentExpenseSubcategoryIds } = await import("../forecastTransactions");

    await expect(listRecentExpenseSubcategoryIds("user-1", "2026-03-30")).resolves.toEqual(["groceries", "transport"]);
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining("transaction_type = 'expense'"), "user-1", "2026-03-30");
    expect(getAllAsync.mock.calls[0]![0]).toContain("transaction_date >= ?");
  });
});
