import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { ExpenseDistributionSection, ForecastActualSection } from "../ReportSections";

const mockGetSnapshot = jest.fn();
const mockGetCashFlowSummary = jest.fn();
const mockGetExpenseCategoryDistribution = jest.fn();

jest.mock("../../../local-db/repositories/dashboardSnapshots", () => ({
  getSnapshot: (...args: unknown[]) => mockGetSnapshot(...args),
}));
jest.mock("../../../local-db/repositories/financialReports", () => ({
  getCashFlowSummary: (...args: unknown[]) => mockGetCashFlowSummary(...args),
  getExpenseCategoryDistribution: (...args: unknown[]) => mockGetExpenseCategoryDistribution(...args),
}));

describe("ForecastActualSection", () => {
  it("shows the next-month HFCE plan independently of the report period", async () => {
    mockGetSnapshot.mockResolvedValue({
      id: "forecast-1",
      user_id: "user-1",
      source: "forecast",
      stale: false,
      updated_at: "2026-09-24T00:00:00.000Z",
      payload_json: JSON.stringify({
        forecasts: [{ category: "food", month: "2026-10", quarter: "2026Q4", amountCentavos: 50_000_000, userBaselineCentavos: 40_000_000, hfceMultiplier: 1.25, hfceForecastAmountMillionPhp: 1_200, explanation: "Personalized food forecast." }],
        modelVersion: "hfce-sarima-v4-category-quarterly",
        status: "SUCCESS",
      }),
    });

    const view = render(<ForecastActualSection userId="user-1" refreshKey={0} />);

    await waitFor(() => {
      expect(view.getByText("PHP 500,000.00")).toBeTruthy();
    });
    expect(view.getByText("2026-10 projected spending")).toBeTruthy();
  });
});

describe("ExpenseDistributionSection", () => {
  it("shows a category share for every chart segment", async () => {
    mockGetExpenseCategoryDistribution.mockResolvedValue([
      { label: "Food", amountCentavos: 7_500 },
      { label: "Transport", amountCentavos: 2_500 },
    ]);

    const view = render(<ExpenseDistributionSection userId="user-1" range={{ startDate: "2026-09-01", endDate: "2026-09-24" }} refreshKey={0} />);

    await waitFor(() => {
      expect(view.getByText("Spending breakdown")).toBeTruthy();
      expect(view.getByText("Food")).toBeTruthy();
      expect(view.getByText("75%")).toBeTruthy();
      expect(view.getByText("Transport")).toBeTruthy();
      expect(view.getByText("25%")).toBeTruthy();
    });
  });
});
