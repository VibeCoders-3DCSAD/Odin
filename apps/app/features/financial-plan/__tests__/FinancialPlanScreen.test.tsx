import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import FinancialPlanScreen from "../FinancialPlanScreen";

const mockGetLatestFinancialPlan = jest.fn();
const mockGetFinancialPlanLabels = jest.fn();
const mockGetFinancialPlanAllocationSpending = jest.fn();
const mockGetFinancialPlanSpentAmount = jest.fn();

jest.mock("../../../local-db/repositories/financialPlans", () => ({
  createFinancialPlan: jest.fn(),
  getLatestFinancialPlan: (...args: unknown[]) => mockGetLatestFinancialPlan(...args),
  getFinancialPlanLabels: (...args: unknown[]) => mockGetFinancialPlanLabels(...args),
  getFinancialPlanAllocationSpending: (...args: unknown[]) => mockGetFinancialPlanAllocationSpending(...args),
  getFinancialPlanSpentAmount: (...args: unknown[]) => mockGetFinancialPlanSpentAmount(...args),
}));

jest.mock("../../../local-db/repositories/forecastTransactions", () => ({
  listRecentExpenseCategoryIds: jest.fn().mockResolvedValue([]),
  listRecentExpenseSubcategoryIds: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../../local-db/repositories/taxonomy", () => ({
  listCategories: jest.fn().mockResolvedValue([]),
  listSubcategories: jest.fn().mockResolvedValue([]),
  updateCategory: jest.fn(),
  updateSubcategory: jest.fn(),
}));

jest.mock("../../../local-db/repositories/financialFoundations", () => ({
  listIncomeSources: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../../local-db/repositories/debtAccounts", () => ({
  listDebtAccounts: jest.fn().mockResolvedValue([]),
}));

jest.mock("../api", () => ({ requestFinancialPlanRecommendation: jest.fn() }));

describe("FinancialPlanScreen", () => {
  beforeEach(() => {
    mockGetLatestFinancialPlan.mockResolvedValue({
      id: "plan-1",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      inputSnapshot: { forecast: { quality: "HIGH" } },
      recommendation: {
        availableFundsCentavos: 100_000,
        allocations: [{ allocationRule: "FLEXIBLE", allocatedAmountCentavos: 60_000, floorAmountCentavos: 0, categoryId: "food" }],
        debtReservations: [],
        savingsReservations: [],
      },
    });
    mockGetFinancialPlanLabels.mockResolvedValue({ categories: { food: "Food" }, subcategories: {}, debtAccounts: {}, savingsGoals: {}, creditCardStatements: {} });
    mockGetFinancialPlanAllocationSpending.mockResolvedValue({ "category:food": 0 });
    mockGetFinancialPlanSpentAmount.mockResolvedValue(0);
  });

  it("opens the saved Financial Plan instead of the category selector", async () => {
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);

    await waitFor(() => expect(view.getByText("Financial Plan")).toBeTruthy());

    expect(view.getByText("Food")).toBeTruthy();
    expect(view.getByText("Remaining Money in Plan")).toBeTruthy();
    expect(view.getByText("₱1,000.00")).toBeTruthy();
    expect(view.getByText("₱600.00 remaining of ₱600.00")).toBeTruthy();
    expect(view.queryByLabelText("Food flexible amount in pesos")).toBeNull();
    expect(view.queryByText(/Forecast trust:/)).toBeNull();
    expect(mockGetLatestFinancialPlan).toHaveBeenCalledWith("user-1");
  });

  it("reduces a saved allocation after its category receives a transaction", async () => {
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByText("₱600.00 remaining of ₱600.00")).toBeTruthy());

    mockGetFinancialPlanAllocationSpending.mockResolvedValue({ "category:food": 10_000 });
    mockGetFinancialPlanSpentAmount.mockResolvedValue(10_000);
    view.rerender(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={1} />);

    await waitFor(() => expect(view.getByText("₱500.00 remaining of ₱600.00")).toBeTruthy());
    expect(view.getByText("₱900.00")).toBeTruthy();
  });
});
