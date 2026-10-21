import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import SavingsContributionAccounts from "../components/SavingsContributionAccounts";
import type { FinancialAccount } from "../../../local-db/repositories/financialFoundations";
const mockGoal = jest.fn(); const mockFunding = jest.fn();
jest.mock("../../../local-db/repositories/savingsGoals", () => ({ getSavingsGoal: (...args: unknown[]) => mockGoal(...args) }));
jest.mock("../../../local-db/repositories/savingsExpenseFunding", () => ({ getSavingsExpenseFunding: (...args: unknown[]) => mockFunding(...args) }));
const account = (id: string, name: string, kind: FinancialAccount["kind"] = "bank"): FinancialAccount => ({ id, name, kind, status: "active", openingBalanceCentavos: 100000, currentBalanceCentavos: 100000, includeInDashboardBalance: true, institutionName: null, openedOn: null, archivedAt: null, sortOrder: 0, creditCardDetails: null });
const accounts = [account("linked", "Savings bank"), account("other", "Payroll"), account("card", "Visa", "credit_card")];
describe("contribution account fields", () => {
  beforeEach(() => { mockGoal.mockResolvedValue({ linkedAccountId: "linked", linkedAccountName: "Savings bank" }); mockFunding.mockResolvedValue({ unallocatedCentavos: 50000 }); });
  it("fixes the destination to the goal's linked account and defaults the source to unallocated money", async () => {
    const onSourceChange = jest.fn();
    const view = render(<SavingsContributionAccounts userId="user" goalId="goal" accounts={accounts} sourceAccountId="" onSourceChange={onSourceChange} />);
    await waitFor(() => expect(view.getByLabelText("To account: Savings bank. Linked account, cannot be changed.")).toBeTruthy());
    expect(mockGoal).toHaveBeenCalledWith("user", "goal");
    expect(mockFunding).toHaveBeenCalledWith("user", "linked", 0);
    expect(onSourceChange).toHaveBeenCalledWith("linked");
    fireEvent.press(view.getByLabelText("To account: Savings bank. Linked account, cannot be changed."));
    expect(view.queryByText("Contribution source")).toBeNull();
  });
  it("offers unallocated funds and other accounts while excluding the linked account and credit cards from transfer choices", async () => {
    const onSourceChange = jest.fn();
    const view = render(<SavingsContributionAccounts userId="user" goalId="goal" accounts={accounts} sourceAccountId="linked" onSourceChange={onSourceChange} />);
    await waitFor(() => expect(view.getByLabelText("Choose contribution source")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Choose contribution source"));
    expect(view.getByLabelText("Available money")).toBeTruthy();
    expect(view.queryByLabelText("Savings bank")).toBeNull();
    expect(view.queryByLabelText("Visa")).toBeNull();
    fireEvent.press(view.getByLabelText("Payroll"));
    expect(onSourceChange).toHaveBeenCalledWith("other");
  });
});
