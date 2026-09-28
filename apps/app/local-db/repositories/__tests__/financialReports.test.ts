import { jest } from "@jest/globals";

const mockGetFirstAsync = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetAllAsync = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
  type: { "": null },
}));
jest.mock("../../client", () => ({ initDatabase: jest.fn() }));

import {
  _resetDbCacheForTesting,
  getAccountBalanceAt,
  getCashFlowComparisonSummary,
  getExpenseCategoryDistribution,
  listCategoryBreakdown,
} from "../financialReports";

beforeEach(() => {
  _resetDbCacheForTesting();
  mockGetFirstAsync.mockReset();
  mockGetAllAsync.mockReset();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initDatabase } = require("../../client");
  initDatabase.mockResolvedValue({ getFirstAsync: mockGetFirstAsync, getAllAsync: mockGetAllAsync });
});

describe("getCashFlowComparisonSummary", () => {
  it("uses the full prior period for weekly and monthly comparisons", async () => {
    mockGetFirstAsync.mockResolvedValue({ income: 20000, expense: 5000 });

    await expect(getCashFlowComparisonSummary("user-1", { startDate: "2026-08-01", endDate: "2026-08-31" }, false)).resolves.toEqual({
      incomeCentavos: 20000,
      expenseCentavos: 5000,
      netCashFlowCentavos: 15000,
    });
    expect(mockGetFirstAsync.mock.calls[0]?.slice(1)).toEqual(["user-1", "2026-08-01", "2026-08-31"]);
  });

  it("averages only months with prior-year activity", async () => {
    mockGetFirstAsync.mockResolvedValue({ income: 125000, expense: 45000, activeMonths: 1 });

    await expect(getCashFlowComparisonSummary("user-1", { startDate: "2025-01-01", endDate: "2025-12-31" }, true)).resolves.toEqual({
      incomeCentavos: 125000,
      expenseCentavos: 45000,
      netCashFlowCentavos: 80000,
    });
    expect(mockGetFirstAsync.mock.calls[0]?.[0]).toContain("COUNT(DISTINCT substr(transaction_date, 1, 7))");
    expect(mockGetFirstAsync.mock.calls[0]?.slice(1)).toEqual(["user-1", "2025-01-01", "2025-12-31"]);
  });
});

describe("getAccountBalanceAt", () => {
  it("reverses subsequent ledger effects to calculate the prior period balance", async () => {
    mockGetFirstAsync.mockResolvedValue({ count: 2, total: 75_000 });

    await expect(getAccountBalanceAt("user-1", "2026-08-31")).resolves.toEqual({
      accountCount: 2,
      balanceCentavos: 75_000,
    });
    const [sql, ...params] = mockGetFirstAsync.mock.calls[0]!;
    expect(sql).toContain("t.transaction_date > ?");
    expect(sql).toContain("t.destination_account_id = fa.id");
    expect(sql).toContain("t.source_account_id = fa.id");
    expect(params).toEqual(["2026-08-31", "user-1", "2026-08-31"]);
  });
});

describe("expense category breakdowns", () => {
  it("groups expenses by the selected HFCE subcategory rather than its catalog parent", async () => {
    mockGetAllAsync.mockResolvedValue([{ label: "Groceries", amountCentavos: 7_500 }]);
    const range = { startDate: "2026-09-01", endDate: "2026-09-30" };

    await expect(listCategoryBreakdown("user-1", range)).resolves.toEqual([{ label: "Groceries", amountCentavos: 7_500 }]);
    await expect(getExpenseCategoryDistribution("user-1", range)).resolves.toEqual([{ label: "Groceries", amountCentavos: 7_500 }]);

    for (const [sql, ...params] of mockGetAllAsync.mock.calls) {
      expect(sql).toContain("COALESCE(s.label, 'Uncategorised')");
      expect(sql).toContain("COALESCE(s.id, 'uncategorised')");
      expect(sql).not.toContain("COALESCE(c.label, 'Uncategorised')");
      expect(params).toEqual(["user-1", "2026-09-01", "2026-09-30"]);
    }
  });
});
