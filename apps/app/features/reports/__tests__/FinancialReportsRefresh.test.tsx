import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import FinancialReportsScreen from "../FinancialReportsScreen";

const mockForecast = jest.fn((_props: unknown) => null);
jest.mock("../../forecast/SpendingForecastScreen", () => ({ __esModule: true, default: (props: unknown) => mockForecast(props) }));
jest.mock("../../alerts/AnomalyAlertsScreen", () => ({ __esModule: true, default: () => null }));
jest.mock("../ReportSections", () => ({
  AllocationSummarySection: () => null, BudgetActualSection: () => null,
  CategoryBreakdownSection: () => null, DebtSummarySection: () => null,
  ExpenseDistributionSection: () => null, ForecastActualSection: () => null,
  SavingsProgressSection: () => null,
}));

it("refreshes the forecast after a sync update and a manual report refresh", () => {
  const view = render(<FinancialReportsScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
  expect(mockForecast).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "user-1", refreshKey: 0 }));
  view.rerender(<FinancialReportsScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={1} />);
  expect(mockForecast).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "user-1", refreshKey: 1 }));
  fireEvent.press(view.getByLabelText("Refresh financial report"));
  expect(mockForecast).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "user-1", refreshKey: 2 }));
});
