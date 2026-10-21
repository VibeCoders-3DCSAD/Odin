import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
const mockListUnusualSpendings = jest.fn<(...args: any[]) => any>();
jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));
jest.mock("../unusualSpending", () => ({ listUnusualSpendings: (...args: unknown[]) => mockListUnusualSpendings(...args) }));

describe("listForecastTransactions", () => {
  beforeEach(() => { jest.resetModules(); mockInitDatabase.mockReset(); });

  it("reads only the current user's posted income and expenses with their purpose-level category slugs", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([{ id: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be", transaction_date: "2026-09-04", amount_centavos: 24550, transaction_type: "expense", merchant_name: "Market", counterparty_name: null, notes: null, category_slug: "food" }]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { _resetDbCacheForTesting, listForecastTransactions } = await import("../forecastTransactions");
    _resetDbCacheForTesting();
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
    const { _resetDbCacheForTesting, listForecastTransactions } = await import("../forecastTransactions");
    _resetDbCacheForTesting();
    await listForecastTransactions("user-1", { fromDate: "2025-09-15" });
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining("t.transaction_date >= ?"), "user-1", "2025-09-15");
  });

  it("leaves out biller and remittance payments only when asked", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { _resetDbCacheForTesting, listForecastTransactions } = await import("../forecastTransactions");
    _resetDbCacheForTesting();
    await listForecastTransactions("user-1", { fromDate: "2025-10-01", excludeScheduledPayments: true });
    await listForecastTransactions("user-1", { fromDate: "2025-10-01" });
    expect(getAllAsync.mock.calls[0]![0]).toContain("NOT EXISTS (SELECT 1 FROM scheduled_payment_records r");
    expect(getAllAsync.mock.calls[1]![0]).not.toContain("scheduled_payment_records");
  });

  it("leaves out unconfirmed unusual spending only when asked", async () => {
    const row = (id: string) => ({ id, transaction_date: "2026-03-06", amount_centavos: 4_200_000, transaction_type: "expense", merchant_name: null, counterparty_name: null, notes: null, category_slug: "communication" });
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockImplementation(async () => [row("laptop"), row("phone"), row("confirmed")]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    mockListUnusualSpendings.mockResolvedValue([{ transactionId: "laptop", confirmedRecurring: false }, { transactionId: "confirmed", confirmedRecurring: true }]);
    const { _resetDbCacheForTesting, listForecastTransactions } = await import("../forecastTransactions");
    _resetDbCacheForTesting();
    const ids = async (excludeUnusualSpending: boolean) => (await listForecastTransactions("user-1", { excludeUnusualSpending })).map((item) => item.transactionId);
    await expect(ids(true)).resolves.toEqual(["confirmed", "phone"]);
    await expect(ids(false)).resolves.toEqual(["confirmed", "phone", "laptop"]);
  });

  it("lists the quarters before the current one, oldest first", async () => {
    const { pastQuarters } = await import("../forecastTransactions");
    expect(pastQuarters(8, new Date("2026-10-21T00:00:00Z"))).toEqual(["2024Q4", "2025Q1", "2025Q2", "2025Q3", "2025Q4", "2026Q1", "2026Q2", "2026Q3"]);
    expect(pastQuarters(1, new Date("2027-01-05T00:00:00Z"))).toEqual(["2026Q4"]);
  });

  it("sums actual expenses per quarter and category, with billers in their own group", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([
      { quarter: "2025Q4", category: "food", amount_centavos: 900_000 },
      { quarter: "2025Q4", category: "billers_remittances", amount_centavos: 10_800_000 },
      { quarter: "2026Q1", category: "food", amount_centavos: 1_000_000 },
    ]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { _resetDbCacheForTesting, listQuarterlySpending } = await import("../forecastTransactions");
    _resetDbCacheForTesting();

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

  it("does not send malformed or zero-value local rows", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([{ id: "bad", transaction_date: "2026-09-04", amount_centavos: 0, transaction_type: "expense", merchant_name: null, counterparty_name: null, notes: null, category_slug: null }]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { _resetDbCacheForTesting, listForecastTransactions } = await import("../forecastTransactions");
    _resetDbCacheForTesting();
    await expect(listForecastTransactions("user-1")).resolves.toEqual([]);
  });

  it("uses the previous twelve calendar months plus the current month", async () => {
    const { getForecastHistoryStartDate } = await import("../forecastTransactions");

    expect(getForecastHistoryStartDate(new Date("2026-09-15T12:00:00Z"))).toBe("2025-09-01");
  });

  it("returns only recent posted expense subcategories for plan recommendations", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([{ subcategory_id: "groceries" }, { subcategory_id: "transport" }]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { _resetDbCacheForTesting, listRecentExpenseSubcategoryIds } = await import("../forecastTransactions");
    _resetDbCacheForTesting();

    await expect(listRecentExpenseSubcategoryIds("user-1", "2026-03-30")).resolves.toEqual(["groceries", "transport"]);
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining("transaction_type = 'expense'"), "user-1", "2026-03-30");
    expect(getAllAsync.mock.calls[0]![0]).toContain("transaction_date >= ?");
  });
});
