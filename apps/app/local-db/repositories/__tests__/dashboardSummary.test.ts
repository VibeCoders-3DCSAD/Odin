import { jest } from "@jest/globals";

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

  it("counts active budgets as present", async () => {
    mockGetFirstAsync.mockResolvedValue(null);
    mockGetAllAsync.mockResolvedValue([]);

    await getDashboardSummary("user-1");

    const budgetCall = mockGetFirstAsync.mock.calls.find(([sql]) => sql.includes("FROM budgets"));
    expect(budgetCall?.[0]).toContain("status IN ('draft', 'active')");
    expect(budgetCall?.[0]).toContain("period_start <= ? AND period_end >= ?");
    expect(budgetCall?.slice(1)).toHaveLength(3);
  });
});
