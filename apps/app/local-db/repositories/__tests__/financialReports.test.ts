import { jest } from "@jest/globals";

const mockGetFirstAsync = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetAllAsync = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
  type: { "": null },
}));
jest.mock("../../client", () => ({ initDatabase: jest.fn() }));

import {
  getAccountBalanceAt,
  getAllocationSummary,
  getBudgetActualSummary,
  getCashFlowComparisonSummary,
  getCashFlowSummary,
  getCashOutflowDistribution,
  listCategoryBreakdown,
} from "../financialReports";

beforeEach(() => {
  mockGetFirstAsync.mockReset();
  mockGetAllAsync.mockReset();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initDatabase } = require("../../client");
  initDatabase.mockResolvedValue({ getFirstAsync: mockGetFirstAsync, getAllAsync: mockGetAllAsync });
});

describe("getCashFlowComparisonSummary", () => {
  it("uses the full prior period for weekly and monthly comparisons", async () => {
    mockGetFirstAsync.mockResolvedValue({ income: 20000, outflow: 5000 });

    await expect(getCashFlowComparisonSummary("user-1", { startDate: "2026-08-01", endDate: "2026-08-31" }, false)).resolves.toEqual({
      incomeCentavos: 20000,
      outflowCentavos: 5000,
      netCashFlowCentavos: 15000,
    });
    expect(mockGetFirstAsync.mock.calls[0]?.slice(1)).toEqual(["user-1", "2026-08-01", "2026-08-31"]);
  });

  it("averages only months with prior-year activity", async () => {
    mockGetFirstAsync.mockResolvedValue({ income: 125000, outflow: 45000, activeMonths: 1 });

    await expect(getCashFlowComparisonSummary("user-1", { startDate: "2025-01-01", endDate: "2025-12-31" }, true)).resolves.toEqual({
      incomeCentavos: 125000,
      outflowCentavos: 45000,
      netCashFlowCentavos: 80000,
    });
    expect(mockGetFirstAsync.mock.calls[0]?.[0]).toContain("COUNT(DISTINCT substr(transaction_date, 1, 7))");
    expect(mockGetFirstAsync.mock.calls[0]?.slice(1)).toEqual(["user-1", "2025-01-01", "2025-12-31"]);
  });
});

describe("getCashFlowSummary", () => {
  it("includes expenses and transfers into savings goals in cash outflow", async () => {
    mockGetFirstAsync.mockResolvedValue({ income: 20_000, outflow: 12_000 });

    await expect(getCashFlowSummary("user-1", { startDate: "2026-09-01", endDate: "2026-09-30" })).resolves.toEqual({
      incomeCentavos: 20_000,
      outflowCentavos: 12_000,
      netCashFlowCentavos: 8_000,
    });
    expect(mockGetFirstAsync.mock.calls[0]?.[0]).toContain("destination_savings_goal_id IS NOT NULL");
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
    // An account opened before the date counts even if it was added to the app later.
    expect(sql).toContain("COALESCE(fa.opened_on, substr(fa.created_at, 1, 10)) <= ?");
    expect(params).toEqual(["2026-08-31", "user-1", "2026-08-31"]);
  });
});

describe("getBudgetActualSummary", () => {
  it("adds every plan period the range touches instead of comparing a year with one month", async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ total: 25_000_000, plans: 10 }).mockResolvedValueOnce({ total: 24_324_673 });

    await expect(getBudgetActualSummary("user-1", { startDate: "2026-01-01", endDate: "2026-10-21" })).resolves.toEqual({
      plannedCentavos: 25_000_000,
      actualCentavos: 24_324_673,
      varianceCentavos: 675_327,
    });
    const [sql, ...params] = mockGetFirstAsync.mock.calls[0]!;
    expect(sql).toContain("SUM(p.available_funds_centavos)");
    expect(sql).toContain("newer.period_start = p.period_start");
    expect(params).toEqual(["user-1", "2026-10-21", "2026-01-01"]);
  });

  it("returns nothing when no accepted plan covers the range", async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ total: null, plans: 0 });

    await expect(getBudgetActualSummary("user-1", { startDate: "2026-01-01", endDate: "2026-01-31" })).resolves.toBeNull();
  });
});

describe("cash outflow breakdowns", () => {
  it("groups expenses by subcategory and classifies savings contributions and debt repayments", async () => {
    mockGetAllAsync.mockResolvedValue([{ label: "Groceries", amountCentavos: 7_500 }]);
    const range = { startDate: "2026-09-01", endDate: "2026-09-30" };

    await expect(listCategoryBreakdown("user-1", range)).resolves.toEqual([{ label: "Groceries", amountCentavos: 7_500 }]);
    await expect(getCashOutflowDistribution("user-1", range)).resolves.toEqual([{ label: "Groceries", amountCentavos: 7_500 }]);

    for (const [index, [sql, ...params]] of mockGetAllAsync.mock.calls.entries()) {
      expect(sql).toContain("COALESCE(s.label, 'Uncategorised')");
      expect(sql).toContain("COALESCE(s.id, 'uncategorised')");
      expect(sql).not.toContain("COALESCE(c.label, 'Uncategorised')");
      expect(sql).toContain("s.user_id = t.user_id");
      expect(params).toEqual(["user-1", index, "2026-09-01", "2026-09-30"]);
    }
    const [cashOutflowSql] = mockGetAllAsync.mock.calls[1]!;
    expect(cashOutflowSql).toContain("'Savings contributions'");
    expect(cashOutflowSql).toContain("'Debt repayments'");
    expect(cashOutflowSql).toContain("t.destination_savings_goal_id IS NOT NULL");
    expect(cashOutflowSql).toContain("FROM debt_payments dp");
    expect(cashOutflowSql).toContain("FROM credit_card_payments cp");
    expect(cashOutflowSql).toContain("FROM scheduled_payment_records spr");
  });
});

describe("getAllocationSummary", () => {
  it("counts the plan's leftover money toward debt and savings and reports what the cycle has spent", async () => {
    mockGetFirstAsync.mockResolvedValue({ category: 30_000, debt: 12_000, savings: 8_000, spent: 21_500 });

    await expect(getAllocationSummary("user-1", { startDate: "2026-10-01", endDate: "2026-10-18" })).resolves.toEqual({ categoryCentavos: 30_000, debtCentavos: 12_000, savingsCentavos: 8_000, spentCentavos: 21_500 });
    const [sql, ...params] = mockGetFirstAsync.mock.calls[0]!;
    expect(sql).toContain("p.debt_surplus_centavos +");
    expect(sql).toContain("p.savings_surplus_centavos +");
    expect(sql).toContain("t.transaction_date >= p.period_start AND t.transaction_date <= p.period_end");
    expect(params).toEqual(["user-1", "2026-10-18", "2026-10-01"]);
  });
});
