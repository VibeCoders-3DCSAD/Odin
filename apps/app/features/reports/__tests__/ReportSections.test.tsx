import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { ExpenseDistributionSection, ForecastActualSection } from "../ReportSections";

const mockGetCashOutflowDistribution = jest.fn();
const mockListForecastTransactions = jest.fn();
const mockListMonthlySpending = jest.fn();
const mockRequestQuarterlyForecast = jest.fn();
const mockGetLatestForecastSnapshot = jest.fn();

jest.mock("../../../local-db/repositories/financialReports", () => ({
  getCashOutflowDistribution: (...args: unknown[]) => mockGetCashOutflowDistribution(...args),
}));
jest.mock("../../../local-db/repositories/forecastTransactions", () => ({
  getForecastHistoryStartDate: jest.requireActual("../../../local-db/repositories/forecastTransactions").getForecastHistoryStartDate,
  listForecastTransactions: (...args: unknown[]) => mockListForecastTransactions(...args),
  listMonthlySpending: (...args: unknown[]) => mockListMonthlySpending(...args),
  recentMonths: () => ["2026-09", "2026-10"],
}));
jest.mock("../../../local-db/repositories/forecastSnapshots", () => ({
  getLatestForecastSnapshot: (...args: unknown[]) => mockGetLatestForecastSnapshot(...args),
}));
jest.mock("../../../local-db/repositories/scheduledPayments", () => ({
  listScheduledPayments: async () => [{ frequency: "monthly", dueDayOfMonth: 15, dueSecondDayOfMonth: null, dueDayOfWeek: null, dueMonth: null, startsOn: "2026-01-15", endsOn: null, amountCentavos: 50_000 }],
}));
jest.mock("../../forecast/api", () => ({
  requestQuarterlyForecast: (...args: unknown[]) => mockRequestQuarterlyForecast(...args),
}));

describe("ExpenseDistributionSection", () => {
  it("shows a category share for every cash outflow segment", async () => {
    mockGetCashOutflowDistribution.mockResolvedValue([
      { label: "Food", amountCentavos: 7_500 },
      { label: "Savings contributions", amountCentavos: 2_500 },
    ]);

    const view = render(<ExpenseDistributionSection userId="user-1" range={{ startDate: "2026-09-01", endDate: "2026-09-24" }} refreshKey={0} />);

    await waitFor(() => {
      expect(view.getByText("Where it went")).toBeTruthy();
      expect(view.getByText("Food")).toBeTruthy();
      expect(view.getByText("75%")).toBeTruthy();
      expect(view.getByText("Savings contributions")).toBeTruthy();
      expect(view.getByText("25%")).toBeTruthy();
    });
  });
});

describe("ForecastActualSection", () => {
  beforeEach(() => { mockRequestQuarterlyForecast.mockClear(); mockListForecastTransactions.mockClear(); mockGetLatestForecastSnapshot.mockResolvedValue(null); mockListForecastTransactions.mockResolvedValue([{ transactionId: "t-1", date: "2026-08-04", amount: 900, category: "food", transactionType: "expense" }]); });

  it("compares last month's forecast, with its scheduled payments, against what was spent", async () => {
    const september = { month: "2026-09", totalCentavos: 100_000, categories: [{ category: "food", amountCentavos: 80_000 }, { category: "transport", amountCentavos: 20_000 }] };
    mockRequestQuarterlyForecast.mockResolvedValue({ response: { ok: true }, body: { payload: { quarters: [{ quarter: "2026Q3", totalCentavos: 100_000, categories: september.categories }], months: [september, { ...september, month: "2026-10" }], modelVersion: "v4", generatedAt: "2026-10-25T00:00:00.000Z", baselineMethod: "same_period_last_year" } } });
    mockListMonthlySpending.mockResolvedValue([{ month: "2026-09", totalCentavos: 170_000, categories: [{ category: "food", amountCentavos: 100_000 }, { category: "transport", amountCentavos: 20_000 }, { category: "billers_remittances", amountCentavos: 50_000 }] }]);

    const view = render(<ForecastActualSection userId="user-1" accessToken="token" refreshKey={0} />);

    await waitFor(() => expect(view.getByText("September 2026 · forecast recalculated from your earlier spending")).toBeTruthy());
    expect(mockListMonthlySpending).toHaveBeenCalledWith("user-1", ["2026-09"]);
    // The chart's forecast, made as of September 1 from the full year before it so last September's seasonal spending counts.
    expect(mockRequestQuarterlyForecast).toHaveBeenCalledWith("token", expect.objectContaining({ asOf: "2026-09-01" }), undefined);
    expect(mockListForecastTransactions).toHaveBeenCalledWith("user-1", expect.objectContaining({ fromDate: "2025-09-01" }));
    // PHP 1,000 forecast plus the PHP 500 biller due on September 15.
    expect(view.getByText("PHP 1,500.00")).toBeTruthy();
    expect(view.getByText("PHP 1,700.00")).toBeTruthy();
    expect(view.getByText("Over forecast")).toBeTruthy();
    expect(view.getByText("PHP 200.00 over")).toBeTruthy();
    // Transport and the biller landed on their forecast, so only food is a difference.
    expect(view.queryByText("Transportation")).toBeNull();
  });

  it("explains when last month had no earlier spending to forecast from", async () => {
    mockRequestQuarterlyForecast.mockResolvedValue({ response: { ok: true }, body: { payload: null, reason: "NO_COMPLETED_MONTH" } });

    const view = render(<ForecastActualSection userId="user-1" accessToken="token" refreshKey={0} />);

    await waitFor(() => expect(view.getByText("Last month had no earlier spending to forecast from.")).toBeTruthy());
  });

  it("uses the latest forecast saved during last month instead of recalculating it", async () => {
    mockGetLatestForecastSnapshot.mockResolvedValue({ generatedAt: "2026-09-28T02:00:00.000Z", quarters: [], modelVersion: "v4", months: [{ month: "2026-09", totalCentavos: 120_000, categories: [{ category: "food", amountCentavos: 120_000 }] }, { month: "2026-10", totalCentavos: 1, categories: [] }] });
    mockListMonthlySpending.mockResolvedValue([{ month: "2026-09", totalCentavos: 100_000, categories: [{ category: "food", amountCentavos: 100_000 }] }]);

    const view = render(<ForecastActualSection userId="user-1" accessToken="token" refreshKey={0} />);

    await waitFor(() => expect(view.getByText("September 2026 · forecast saved Sep 28")).toBeTruthy());
    expect(mockGetLatestForecastSnapshot).toHaveBeenCalledWith("user-1", "2026-09");
    expect(mockRequestQuarterlyForecast).not.toHaveBeenCalled();
    expect(view.getByText("PHP 200.00 under")).toBeTruthy();
  });
});
