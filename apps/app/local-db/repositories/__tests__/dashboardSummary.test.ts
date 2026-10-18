import { jest } from "@jest/globals";
import { createSqliteHarness } from "./sqliteHarness";

const mockGetFirstAsync = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetAllAsync = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
  type: { "": null },
}));
jest.mock("../../client", () => ({
  initDatabase: jest.fn(),
}));

import { getDashboardSummary, _resetDbCacheForTesting } from "../dashboardSummary";

beforeEach(() => {
  _resetDbCacheForTesting();
  mockGetFirstAsync.mockReset();
  mockGetAllAsync.mockReset();

  // resetMocks clears implementations; re-set initDatabase before each test
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initDatabase } = require("../../client");
  initDatabase.mockImplementation(() =>
    Promise.resolve({
      getFirstAsync: mockGetFirstAsync,
      getAllAsync: mockGetAllAsync,
    }),
  );
});

describe("getDashboardSummary", () => {
  it("returns zeros and empty array when no data exists", async () => {
    mockGetFirstAsync.mockResolvedValue(null);
    mockGetAllAsync.mockResolvedValue([]);

    const summary = await getDashboardSummary("user-1");

    expect(summary.currentBalanceCentavos).toBe(0);
    expect(summary.currentMonthIncomeCentavos).toBe(0);
    expect(summary.currentMonthExpenseCentavos).toBe(0);
    expect(summary.previousMonthIncomeCentavos).toBe(0);
    expect(summary.previousMonthExpenseCentavos).toBe(0);
    expect(summary.accountCount).toBe(0);
    expect(summary.incomeSourceCount).toBe(0);
    expect(summary.budgetCount).toBe(0);
    expect(summary.transactionCount).toBe(0);
    expect(summary.recentTransactions).toEqual([]);
  });

  it("sums active accounts with include_in_dashboard_balance", async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce({ total: 50000 })
      .mockResolvedValueOnce({ income: 10000, expense: 3000 })
      .mockResolvedValueOnce({ income: 8000, expense: 2500 });
    mockGetAllAsync.mockResolvedValue([]);

    const summary = await getDashboardSummary("user-1");

    expect(summary.currentBalanceCentavos).toBe(50000);
    expect(summary.currentMonthIncomeCentavos).toBe(10000);
    expect(summary.currentMonthExpenseCentavos).toBe(3000);
    expect(summary.previousMonthIncomeCentavos).toBe(8000);
    expect(summary.previousMonthExpenseCentavos).toBe(2500);
  });

  it("excludes transfers from income/expense totals", async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce({ total: 0 })
      .mockResolvedValueOnce({ income: 5000, expense: 2000 })
      .mockResolvedValueOnce({ income: 0, expense: 0 });
    mockGetAllAsync.mockResolvedValue([]);

    const summary = await getDashboardSummary("user-1");

    expect(summary.currentMonthIncomeCentavos).toBe(5000);
    expect(summary.currentMonthExpenseCentavos).toBe(2000);
  });

  it("returns recent transactions ordered by date desc", async () => {
    mockGetFirstAsync.mockResolvedValue(null);
    mockGetAllAsync.mockResolvedValue([
      { id: "t1", transaction_type: "expense", amount_centavos: 1000, transaction_date: "2024-07-20", merchant_name: "Coffee", counterparty_name: null },
    ]);

    const summary = await getDashboardSummary("user-1");

    expect(summary.recentTransactions).toHaveLength(1);
    expect(summary.recentTransactions[0]!.id).toBe("t1");
    expect(mockGetAllAsync.mock.calls[0]![0]).toContain("transaction_type = 'expense'");
  });

  it("scopes queries by user_id", async () => {
    mockGetFirstAsync.mockResolvedValue(null);
    mockGetAllAsync.mockResolvedValue([]);

    await getDashboardSummary("user-42");

    const balanceCall = mockGetFirstAsync.mock.calls[0]!;
    expect(balanceCall[1]).toBe("user-42");

    const recentCall = mockGetAllAsync.mock.calls[0]!;
    expect(recentCall[1]).toBe("user-42");
  });

  it("groups spending by the category rather than its category group", async () => {
    mockGetFirstAsync.mockResolvedValue(null);
    mockGetAllAsync.mockResolvedValue([]);

    await getDashboardSummary("user-1");

    const spendingCall = mockGetAllAsync.mock.calls[1]!;
    expect(spendingCall[0]).toContain("COALESCE(c.label, 'Other') AS category_label");
    expect(spendingCall[0]).not.toContain("category_groups");
  });

  it("counts accepted Financial Plans as present", async () => {
    mockGetFirstAsync.mockResolvedValue(null);
    mockGetAllAsync.mockResolvedValue([]);

    await getDashboardSummary("user-1");

    const planCall = mockGetFirstAsync.mock.calls.find(([sql]) => sql.includes("FROM financial_plans"));
    expect(planCall?.[0]).toContain("status = 'accepted'");
    expect(planCall?.[0]).toContain("period_start <= ? AND period_end >= ?");
    expect(planCall?.slice(1)).toHaveLength(3);
  });

  it("loads saved visuals, groups direct and subcategory expenses, and excludes other users' taxonomy", async () => {
    const harness = createSqliteHarness();
    try {
      await harness.migrateAll();
      const { initDatabase } = require("../../client");
      initDatabase.mockResolvedValue(harness.db);
      harness.sqlite.exec(`
        INSERT INTO categories (id, user_id, slug, label, description, icon_key, color_hex, created_at, updated_at) VALUES
          ('food', 'user-1', 'food', 'Food', 'Food', 'bowl-food', '#E86A33', 'now', 'now'),
          ('foreign', 'user-2', 'health', 'Private health', 'Health', 'first-aid', '#15803D', 'now', 'now');
        INSERT INTO subcategories (id, user_id, category_id, slug, label, description, icon_key, color_hex, created_at, updated_at) VALUES
          ('bakery', 'user-1', 'food', 'food_bakery', 'Bakery', 'Bakery', 'bread', '#D97706', 'now', 'now'),
          ('foreign-sub', 'user-2', 'foreign', 'health_dental', 'Private dental', 'Dental', 'tooth', '#15803D', 'now', 'now');
      `);
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const insert = harness.sqlite.prepare(`
        INSERT INTO transactions (id, user_id, transaction_type, transaction_date, amount_centavos, category_id, subcategory_id, created_at, updated_at)
        VALUES (?, ?, 'expense', ?, ?, ?, ?, 'now', 'now')
      `);
      insert.run("direct", "user-1", date, 100, "food", null);
      insert.run("sub", "user-1", date, 200, null, "bakery");
      insert.run("bad-sub", "user-1", date, 300, null, "foreign-sub");
      insert.run("bad-category", "user-1", date, 400, "foreign", null);
      insert.run("other-user", "user-2", date, 9000, "foreign", null);

      const summary = await getDashboardSummary("user-1");
      expect(summary.currentMonthExpenseCentavos).toBe(1000);
      expect(summary.categorySpending).toEqual(expect.arrayContaining([
        expect.objectContaining({ category_id: "food", category_label: "Food", icon_key: "bowl-food", color_hex: "#E86A33", total_centavos: 300 }),
        expect.objectContaining({ category_id: null, category_label: "Other", icon_key: null, color_hex: null, total_centavos: 700 }),
      ]));
      expect(summary.recentTransactions.find((tx) => tx.id === "sub")).toMatchObject({ category_label: "Bakery", icon_key: "bread", color_hex: "#D97706" });
      expect(summary.recentTransactions.find((tx) => tx.id === "direct")).toMatchObject({ category_label: "Food", icon_key: "bowl-food", color_hex: "#E86A33" });
      expect(summary.recentTransactions.find((tx) => tx.id === "bad-sub")).toMatchObject({ category_label: null, icon_key: null, color_hex: null });
      expect(summary.recentTransactions.find((tx) => tx.id === "bad-category")).toMatchObject({ category_label: null, icon_key: null, color_hex: null });
      expect(summary.recentTransactions.some((tx) => tx.id === "other-user")).toBe(false);
    } finally {
      harness.sqlite.close();
    }
  });
});
