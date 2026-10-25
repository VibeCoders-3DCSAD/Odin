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

  it("recommends by last year's seasons once there is a full year of history", async () => {
    const months = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
    const row = (id: string, date: string, subcategoryId: string | null, categoryId: string, amount = 10_000) => ({ id, transaction_date: date, amount_centavos: amount, subcategory_id: subcategoryId, category_id: categoryId });
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([
      ...months.map((month) => row(`internet-${month}`, `${month}-20`, "internet", "communication")),
      row("gifts", "2025-12-05", "gifts", "misc", 40_000),
      row("tuition-june", "2026-06-10", "tuition", "education", 30_000),
      row("tuition-july", "2026-07-10", "tuition", "education", 30_000),
      row("one-off", "2025-12-08", "gadgets", "misc", 90_000),
      row("fees", "2025-11-02", "fees", "misc", 5_000),
    ]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    mockListUnusualSpendings.mockResolvedValue([{ transactionId: "one-off" }]);
    mockListSavedRecurrences.mockResolvedValue(new Map([["fees", "yearly"]]));
    const { listPlanRecommendations } = await import("../forecastTransactions");

    const december = await listPlanRecommendations("user-1", "2026-12", new Date("2026-10-18T04:00:00Z"));
    expect(december).toMatchObject({ seasonal: true, subcategoryIds: ["internet", "gifts"], categoryIds: [] });
    expect(december.historySubcategoryIds).toEqual(expect.arrayContaining(["internet", "gifts", "tuition", "fees"]));
    expect(december.historySubcategoryIds).not.toContain("gadgets");
    expect(Object.keys(december.expectedSpend.subcategories).sort()).toEqual(["gifts", "internet"]);
    await expect(listPlanRecommendations("user-1", "2026-11", new Date("2026-10-18T04:00:00Z"))).resolves.toMatchObject({ subcategoryIds: ["internet", "fees"] });
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining("t.transaction_type = 'expense' AND t.status = 'posted'"), "user-1", "2025-10-01");
  });

  it("recommends the past 6 months of spending with less than a year of history", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([
      { id: "old", transaction_date: "2026-03-01", amount_centavos: 10_000, subcategory_id: "tuition", category_id: "education" },
      { id: "recent", transaction_date: "2026-09-01", amount_centavos: 10_000, subcategory_id: "groceries", category_id: "food" },
      { id: "direct", transaction_date: "2026-09-02", amount_centavos: 10_000, subcategory_id: null, category_id: "transport" },
      { id: "bill", transaction_date: "2026-09-05", amount_centavos: 30_000, subcategory_id: "internet", category_id: "utilities", scheduled: 1 },
    ]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    mockListUnusualSpendings.mockResolvedValue([]);
    mockListSavedRecurrences.mockResolvedValue(new Map());
    const { listPlanRecommendations } = await import("../forecastTransactions");

    await expect(listPlanRecommendations("user-1", "2026-10", new Date("2026-10-18T04:00:00Z"))).resolves.toEqual({
      seasonal: false, subcategoryIds: ["groceries", "internet"], categoryIds: ["transport"],
      historySubcategoryIds: ["tuition", "groceries", "internet"], historyCategoryIds: ["education", "food", "transport", "utilities"],
      // Two months of spending averaged; the biller payment is reserved by the plan, so it is not expected spending.
      expectedSpend: { subcategories: { tuition: 5_000, groceries: 5_000 }, categories: { education: 5_000, food: 5_000, transport: 5_000 } },
    });
  });
});
