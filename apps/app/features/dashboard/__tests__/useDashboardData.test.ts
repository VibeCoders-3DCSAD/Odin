import { jest } from "@jest/globals";

const mockGetDashboardSummary = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetDailyTrends = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetAllSnapshots = jest.fn<(...args: any[]) => Promise<any>>();
const mockRunSync = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock("../../../local-db/repositories/dashboardSummary", () => ({
  getDashboardSummary: (...args: any[]) => mockGetDashboardSummary(...args),
  getDailyTrends: (...args: any[]) => mockGetDailyTrends(...args),
}));
jest.mock("../../../local-db/repositories/dashboardSnapshots", () => ({ getAllSnapshots: (...args: any[]) => mockGetAllSnapshots(...args) }));
jest.mock("../../../local-db/sync/runSync", () => ({ runSync: (...args: any[]) => mockRunSync(...args) }));

import { loadDashboardData, refreshDashboardData } from "../hooks/useDashboardData";

test("preserves available dashboard sections when another section fails", async () => {
  mockGetDashboardSummary.mockResolvedValue({
    currentBalanceCentavos: 0,
    currentMonthIncomeCentavos: 0,
    currentMonthExpenseCentavos: 0,
    previousMonthIncomeCentavos: 0,
    previousMonthExpenseCentavos: 0,
    accountCount: 1,
    incomeSourceCount: 0,
    budgetCount: 0,
    transactionCount: 0,
    recentTransactions: [],
    categoryGroupSpending: [],
  });
  mockGetDailyTrends.mockRejectedValue(new Error("offline"));
  mockGetAllSnapshots.mockResolvedValue({ budget_health: null, alerts: null, savings_goals: null, debt_status: null, forecast: null });

  await expect(loadDashboardData("user-1")).resolves.toMatchObject({
    summary: { accountCount: 1 },
    trends: null,
    snapshots: { forecast: null },
    summaryUnavailable: false,
    snapshotsUnavailable: false,
    error: "Some dashboard information is unavailable. Try refreshing to recover it.",
  });
});

test("reports unsuccessful and rejected refreshes as failures", async () => {
  mockRunSync.mockResolvedValueOnce({ successful: false }).mockRejectedValueOnce(new Error("offline"));

  await expect(refreshDashboardData("user-1", "device-1", "token-1")).resolves.toBe(false);
  await expect(refreshDashboardData("user-1", "device-1", "token-1")).resolves.toBe(false);
});
