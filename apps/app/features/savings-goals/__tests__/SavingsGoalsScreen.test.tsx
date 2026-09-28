import React from "react";
import { render, waitFor } from "@testing-library/react-native";
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

  it("shows active savings accounts on the Savings & Goals overview", async () => {
    const view = render(<SavingsGoalsScreen userId="user-1" deviceId="device-1" />);

    await waitFor(() => {
      expect(view.getByText("Savings accounts")).toBeTruthy();
      expect(view.getByText("Maribank HYSA")).toBeTruthy();
      expect(view.getByLabelText("Open Maribank HYSA")).toBeTruthy();
    });
  });
});
