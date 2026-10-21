import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { CashFlowSection, ExpenseDistributionSection } from "../ReportSections";

const mockGetCashFlowSummary = jest.fn();
const mockGetCashFlowComparisonSummary = jest.fn();
const mockGetCashOutflowDistribution = jest.fn();

jest.mock("../../../local-db/repositories/financialReports", () => ({
  getCashFlowSummary: (...args: unknown[]) => mockGetCashFlowSummary(...args),
  getCashFlowComparisonSummary: (...args: unknown[]) => mockGetCashFlowComparisonSummary(...args),
  getCashOutflowDistribution: (...args: unknown[]) => mockGetCashOutflowDistribution(...args),
}));

describe("ExpenseDistributionSection", () => {
  it("shows a category share for every cash outflow segment", async () => {
    mockGetCashOutflowDistribution.mockResolvedValue([
      { label: "Food", amountCentavos: 7_500 },
      { label: "Savings contributions", amountCentavos: 2_500 },
    ]);

    const view = render(<ExpenseDistributionSection userId="user-1" range={{ startDate: "2026-09-01", endDate: "2026-09-24" }} refreshKey={0} />);

    await waitFor(() => {
      expect(view.getByText("Cash outflow breakdown")).toBeTruthy();
      expect(view.getByText("Food")).toBeTruthy();
      expect(view.getByText("75%")).toBeTruthy();
      expect(view.getByText("Savings contributions")).toBeTruthy();
      expect(view.getByText("25%")).toBeTruthy();
    });
  });
});

describe("CashFlowSection", () => {
  it.each([
    { income: 25_000, outflow: 15_000, incomeColor: "#087A4A", outflowColor: "#B42318", incomePercent: "+25.0%", outflowPercent: "+50.0%" },
    { income: 15_000, outflow: 5_000, incomeColor: "#B42318", outflowColor: "#087A4A", incomePercent: "-25.0%", outflowPercent: "-50.0%" },
    { income: 20_000, outflow: 10_000, incomeColor: "#6B7A6F", outflowColor: "#6B7A6F", incomePercent: "0.0%", outflowPercent: "0.0%" },
  ])("colors income $income and outflow $outflow by whether the change is favorable", async ({ income, outflow, incomeColor, outflowColor, incomePercent, outflowPercent }) => {
    mockGetCashFlowSummary.mockResolvedValue({ incomeCentavos: income, outflowCentavos: outflow, netCashFlowCentavos: income - outflow });
    mockGetCashFlowComparisonSummary.mockResolvedValue({ incomeCentavos: 20_000, outflowCentavos: 10_000, netCashFlowCentavos: 10_000 });

    const view = render(<CashFlowSection userId="user-1" range={{ startDate: "2026-09-01", endDate: "2026-09-24" }} comparison={{ range: { startDate: "2026-08-01", endDate: "2026-08-31" }, label: "last month", averageByActiveMonth: false }} refreshKey={0} />);

    await waitFor(() => {
      const percentages = view.getAllByText(/^[+-]?[\d.]+%$/);
      expect(percentages[0].props.children).toEqual([incomePercent.slice(0, -1), "%"]);
      expect(percentages[1].props.children).toEqual([outflowPercent.slice(0, -1), "%"]);
      expect(percentages[0].props.style).toMatchObject({ color: incomeColor });
      expect(percentages[1].props.style).toMatchObject({ color: outflowColor });
    });
  });

  it("compares this year's average month, not its total, with last year's average month", async () => {
    mockGetCashFlowSummary.mockResolvedValue({ incomeCentavos: 25_000_000, outflowCentavos: 24_324_673, netCashFlowCentavos: 675_327 });
    mockGetCashFlowComparisonSummary.mockImplementation(async (_userId: string, range: { startDate: string }) => range.startDate === "2026-01-01"
      ? { incomeCentavos: 2_500_000, outflowCentavos: 2_432_467, netCashFlowCentavos: 67_533 }
      : { incomeCentavos: 2_500_000, outflowCentavos: 2_500_000, netCashFlowCentavos: 0 });

    const view = render(<CashFlowSection userId="user-1" range={{ startDate: "2026-01-01", endDate: "2026-10-21" }} comparison={{ range: { startDate: "2025-01-01", endDate: "2025-12-31" }, label: "last year's average month", averageByActiveMonth: true }} refreshKey={0} />);

    await waitFor(() => {
      const percentages = view.getAllByText(/^[+-]?[\d.]+%$/);
      expect(percentages[0].props.children).toEqual(["0.0", "%"]);
      expect(percentages[1].props.children).toEqual(["-2.7", "%"]);
    });
    expect(view.getByText("PHP 250,000.00")).toBeTruthy();
    expect(view.getAllByText("per month vs last year's average month")).toHaveLength(2);
  });

  it("labels spending, savings contributions, and debt repayments as outflow", async () => {
    mockGetCashFlowSummary.mockResolvedValue({ incomeCentavos: 25_000, outflowCentavos: 15_000, netCashFlowCentavos: 10_000 });
    mockGetCashFlowComparisonSummary.mockResolvedValue({ incomeCentavos: 20_000, outflowCentavos: 10_000, netCashFlowCentavos: 10_000 });

    const view = render(<CashFlowSection userId="user-1" range={{ startDate: "2026-09-01", endDate: "2026-09-24" }} comparison={{ range: { startDate: "2026-08-01", endDate: "2026-08-31" }, label: "last month", averageByActiveMonth: false }} refreshKey={0} />);

    await waitFor(() => {
      expect(view.getByText("Income")).toBeTruthy();
      expect(view.getByText("Outflow")).toBeTruthy();
    });
  });
});
