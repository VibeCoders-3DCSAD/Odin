import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import SavingsGoalsScreen from "../SavingsGoalsScreen";

const mockListFinancialAccounts = jest.fn();
const mockListSavingsGoals = jest.fn();

jest.mock("../../../local-db/repositories/financialFoundations", () => ({
  listFinancialAccounts: (...args: unknown[]) => mockListFinancialAccounts(...args),
}));
jest.mock("../../../local-db/repositories/savingsGoals", () => ({
  archiveSavingsGoal: jest.fn(),
  deleteSavingsGoal: jest.fn(),
  getSavingsGoal: jest.fn(),
  listSavingsGoals: (...args: unknown[]) => mockListSavingsGoals(...args),
  restoreSavingsGoal: jest.fn(),
}));
jest.mock("../../../local-db/repositories/savingsGoalActivities", () => ({ listSavingsGoalActivities: jest.fn() }));
jest.mock("../../../local-db/repositories/savingsAccountDetails", () => ({
  getSavingsAccountDetails: jest.fn(),
  listScheduledSavingsAccounts: jest.fn().mockResolvedValue([{
    accountId: "savings-1",
    name: "Maribank HYSA",
    plannedContributionAmountCentavos: 500_000,
    contributionFrequency: "monthly",
    contributionIntervalCount: 1,
    contributionDayOfMonth: null,
    contributionSecondDayOfMonth: null,
    contributionDayOfWeek: null,
    customIntervalDays: null,
    nextContributionDate: "2026-10-14",
  }]),
}));
jest.mock("../../../local-db/repositories/ledger", () => ({ listSavingsAccountMovements: jest.fn() }));
jest.mock("../../savings-forecast/SavingsForecastSection", () => ({ SavingsForecastSection: () => null }));
jest.mock("../SavingsAllocationReview", () => () => null);

describe("SavingsGoalsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListSavingsGoals.mockResolvedValue([]);
    mockListFinancialAccounts.mockResolvedValue([{
      id: "savings-1",
      name: "Maribank HYSA",
      kind: "savings",
      status: "active",
      openingBalanceCentavos: 550_000,
      currentBalanceCentavos: 550_000,
      includeInDashboardBalance: true,
      institutionName: "Maribank",
      openedOn: null,
      archivedAt: null,
      sortOrder: 0,
      savingsAccountType: "high_yield_savings",
      creditCardDetails: null,
    }]);
  });

  it("shows one Savings Goals overview without separate savings accounts", async () => {
    const view = render(<SavingsGoalsScreen userId="user-1" deviceId="device-1" />);

    await waitFor(() => {
      expect(view.getByText("Savings Goals")).toBeTruthy();
      expect(view.getByText("Total saved: ₱0.00")).toBeTruthy();
    });
    expect(view.queryByText("Savings accounts")).toBeNull();
    expect(view.queryByText("Goal savings")).toBeNull();
    expect(view.queryByText("Maribank HYSA")).toBeNull();
    expect(mockListFinancialAccounts).not.toHaveBeenCalled();
    expect(mockListSavingsGoals).toHaveBeenCalledWith("user-1", "active");

  });

  it("opens a savable goal form from the Goals page", async () => {
    const view = render(<SavingsGoalsScreen userId="user-1" deviceId="device-1" />);
    await waitFor(() => expect(view.getByLabelText("Add savings goal")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Add savings goal"));
    expect(view.getByLabelText("Goal name")).toBeTruthy();
    expect(view.getByLabelText("Save savings goal")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Cancel"));
    expect(view.getByText("Savings Goals")).toBeTruthy();
  });

  it("keeps archived savings goals accessible in the same screen", async () => {
    const view = render(<SavingsGoalsScreen userId="user-1" deviceId="device-1" />);
    await waitFor(() => expect(view.getByLabelText("Archived goals")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Archived goals"));
    await waitFor(() => expect(mockListSavingsGoals).toHaveBeenCalledWith("user-1", "archived"));
    expect(view.getByText("No archived savings goals yet.")).toBeTruthy();
    expect(view.queryByLabelText("Add savings goal")).toBeNull();
    fireEvent.press(view.getByLabelText("Active goals"));
    await waitFor(() => expect(view.getByLabelText("Add savings goal")).toBeTruthy());
  });

  it("shows a loading error on the unified overview", async () => {
    mockListSavingsGoals.mockRejectedValueOnce(new Error("unavailable"));
    const view = render(<SavingsGoalsScreen userId="user-1" deviceId="device-1" />);
    await waitFor(() => expect(view.getByText("Your savings goals could not be loaded. Please try again.")).toBeTruthy());
  });

});
