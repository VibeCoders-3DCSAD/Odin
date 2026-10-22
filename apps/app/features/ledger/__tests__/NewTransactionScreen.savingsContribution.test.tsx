import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import NewTransactionScreen from "../NewTransactionScreen";
import type { FinancialAccount } from "../../../local-db/repositories/financialFoundations";

const mockContribution = jest.fn();
const mockTransfer = jest.fn();
const mockGoals = jest.fn();
const mockCreated = jest.fn();
const account = (id: string, name: string): FinancialAccount => ({ id, name, kind: "bank", status: "active", openingBalanceCentavos: 100000, currentBalanceCentavos: 100000, includeInDashboardBalance: true, institutionName: null, openedOn: null, archivedAt: null, sortOrder: 0, creditCardDetails: null });
const mockAccounts = [account("linked", "Savings bank"), account("payroll", "Payroll")];
const mockGoal = { id: "goal", name: "Emergency fund", status: "active", linkedAccountId: "linked", linkedAccountName: "Savings bank" };

jest.mock("../hooks/useTransactionData", () => ({ useTransactionData: () => ({ accounts: mockAccounts, categories: [], subcategories: [], loading: false, error: null }) }));
jest.mock("../../../local-db/repositories/ledger", () => ({ createSavingsGoalTransfer: (...args: unknown[]) => mockContribution(...args), createTransfer: (...args: unknown[]) => mockTransfer(...args) }));
jest.mock("../../../local-db/repositories/savingsGoals", () => ({ getSavingsGoal: (_userId: string, id: string) => Promise.resolve(id === "second-goal" ? { ...mockGoal, id, linkedAccountId: "payroll", linkedAccountName: "Payroll" } : mockGoal) }));
jest.mock("../../../local-db/repositories/savingsGoalContributions", () => ({ listSavingsContributionGoals: (...args: unknown[]) => mockGoals(...args) }));
jest.mock("../../../local-db/repositories/savingsExpenseFunding", () => ({ getSavingsExpenseFunding: () => Promise.resolve({ unallocatedCentavos: 50000 }) }));
jest.mock("../../../local-db/repositories/debtAccounts", () => ({ listDebtAccounts: () => Promise.resolve([]) }));
jest.mock("../../../local-db/repositories/debtPayments", () => ({}));
jest.mock("../../../local-db/repositories/creditCardPayments", () => ({}));
jest.mock("../../../local-db/repositories/creditCardStatements", () => ({}));
jest.mock("../../../local-db/repositories/creditCardInstallments", () => ({}));
jest.mock("../../../local-db/repositories/unusualSpending", () => ({}));
jest.mock("../../../local-db/sync/runSync", () => ({ runSync: () => Promise.resolve() }));
jest.mock("../../../components/Toast", () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock("../../../services/connectivity", () => ({ useConnectivityStore: () => false }));
jest.mock("@react-native-community/datetimepicker", () => () => null);

function form() {
  return render(<NewTransactionScreen userId="user" deviceId="device" accessToken="token" onClose={() => {}} onCreated={mockCreated} />);
}

async function chooseGoal(view: ReturnType<typeof form>) {
  fireEvent.press(view.getByLabelText("This is a savings contribution"));
  fireEvent.press(await view.findByLabelText("Choose savings goal"));
  fireEvent.press(view.getByLabelText("Emergency fund"));
  await view.findByLabelText("Choose contribution source");
}

describe("new transaction savings contributions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGoals.mockResolvedValue([mockGoal]);
    mockContribution.mockResolvedValue({});
  });

  it.each(["linked", "payroll"])("records a contribution funded by %s using the savings transfer flow", async (source) => {
    const view = form();
    await chooseGoal(view);
    expect(view.getByLabelText("To account: Savings bank. Linked account, cannot be changed.")).toBeTruthy();
    if (source === "payroll") {
      fireEvent.press(view.getByLabelText("Choose contribution source"));
      fireEvent.press(view.getByLabelText("Payroll"));
    }
    fireEvent.changeText(view.getByLabelText("Payment amount"), "100");
    fireEvent.press(view.getByLabelText("Save transaction"));
    await waitFor(() => expect(mockContribution).toHaveBeenCalledWith("user", "device", expect.objectContaining({ savings_goal_id: "goal", kind: "contribution", account_id: source, amount_centavos: 10000 })));
    await waitFor(() => expect(mockCreated).toHaveBeenCalledWith(null));
    expect(mockTransfer).not.toHaveBeenCalled();
    expect(mockGoals).toHaveBeenCalledWith("user");
  });

  it("defaults to the new linked account when the selected savings goal changes", async () => {
    mockGoals.mockResolvedValue([mockGoal, { ...mockGoal, id: "second-goal", name: "Holiday", linkedAccountId: "payroll", linkedAccountName: "Payroll" }]);
    const view = form();
    await chooseGoal(view);
    fireEvent.press(view.getByLabelText("Choose savings goal"));
    fireEvent.press(view.getByLabelText("Holiday"));
    await view.findByLabelText("To account: Payroll. Linked account, cannot be changed.");
    fireEvent.changeText(view.getByLabelText("Payment amount"), "100");
    fireEvent.press(view.getByLabelText("Save transaction"));
    await waitFor(() => expect(mockContribution).toHaveBeenCalledWith("user", "device", expect.objectContaining({ savings_goal_id: "second-goal", account_id: "payroll" })));
    await waitFor(() => expect(mockCreated).toHaveBeenCalled());
  });

  it("returns to a regular transfer when the option is turned off", async () => {
    const view = form();
    await chooseGoal(view);
    fireEvent.press(view.getByLabelText("This is a savings contribution"));
    expect(view.queryByLabelText("Choose savings goal")).toBeNull();
    expect(view.queryByLabelText("Choose contribution source")).toBeNull();
    expect(view.getByText("From account")).toBeTruthy();
    expect(view.getByText("To account")).toBeTruthy();
    fireEvent.changeText(view.getByLabelText("Payment amount"), "100");
    fireEvent.press(view.getByLabelText("Save transaction"));
    expect(view.getByText("Select a source account")).toBeTruthy();
    expect(mockContribution).not.toHaveBeenCalled();
  });

  it("requires a savings goal before saving", async () => {
    const view = form();
    fireEvent.press(view.getByLabelText("This is a savings contribution"));
    await view.findByLabelText("Choose savings goal");
    fireEvent.changeText(view.getByLabelText("Payment amount"), "100");
    fireEvent.press(view.getByLabelText("Save transaction"));
    expect(view.getByText("Select a savings goal")).toBeTruthy();
    expect(mockContribution).not.toHaveBeenCalled();
    expect(mockTransfer).not.toHaveBeenCalled();
  });

  it("clears contribution mode when selecting another transaction type", async () => {
    const view = form();
    await chooseGoal(view);
    fireEvent.press(view.getByText("Income"));
    expect(view.queryByLabelText("Choose savings goal")).toBeNull();
    expect(view.queryByLabelText("Choose contribution source")).toBeNull();
    expect(view.getByText("Destination account")).toBeTruthy();
  });

  it("explains when no savings goals have a linked account", async () => {
    mockGoals.mockResolvedValue([]);
    const view = form();
    fireEvent.press(view.getByLabelText("This is a savings contribution"));
    expect(await view.findByText("Add an active savings goal and link it to an account before recording a contribution.")).toBeTruthy();
    expect(view.queryByLabelText("Choose savings goal")).toBeNull();
  });
});
