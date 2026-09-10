import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import FinancialAccountsScreen from "../FinancialAccountsScreen";

type MockDatePickerProps = {
  value: Date;
  mode: string;
  onChange: (event: { type: string }, date?: Date) => void;
};

const mockListFinancialAccounts = jest.fn();
const mockCreateFinancialAccount = jest.fn();
const mockUpdateFinancialAccount = jest.fn();
const mockDeleteFinancialAccount = jest.fn();
const mockDatePickerRef: { props: MockDatePickerProps | null } = { props: null };

jest.mock("../../../local-db/repositories/financialFoundations", () => ({
  listFinancialAccounts: (...args: unknown[]) => mockListFinancialAccounts(...args),
  createFinancialAccount: (...args: unknown[]) => mockCreateFinancialAccount(...args),
  updateFinancialAccount: (...args: unknown[]) => mockUpdateFinancialAccount(...args),
  deleteFinancialAccount: (...args: unknown[]) => mockDeleteFinancialAccount(...args),
}));

jest.mock("@react-native-community/datetimepicker", () => {
  const MockDateTimePicker = (props: MockDatePickerProps) => {
    mockDatePickerRef.props = props;
    return null;
  };
  return { __esModule: true, default: MockDateTimePicker };
});

jest.mock("phosphor-react-native", () => {
  const Stub = () => null;
  return new Proxy(
    { __esModule: true },
    { get: (_target, key) => (key === "__esModule" ? true : Stub) },
  );
});

jest.mock("../../../components/KebabTooltip", () => {
  const Stub = () => null;
  return { __esModule: true, default: Stub };
});

jest.mock("../../../components/AvailableBalanceCard", () => {
  const Stub = () => null;
  return { __esModule: true, default: Stub };
});

function renderScreen() {
  return render(
    <FinancialAccountsScreen userId="test-user" deviceId="test-device" onBack={jest.fn()} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDatePickerRef.props = null;
  mockListFinancialAccounts.mockResolvedValue([]);
  mockCreateFinancialAccount.mockResolvedValue({});
  mockUpdateFinancialAccount.mockResolvedValue({});
  mockDeleteFinancialAccount.mockResolvedValue({});
});

it("shows credit card fields only when the Credit Card kind is selected", () => {
  const view = renderScreen();

  fireEvent.press(view.getByTestId("add-account"));

  expect(view.queryByPlaceholderText("Enter credit limit")).toBeNull();

  fireEvent.press(view.getByLabelText("Credit Card"));

  expect(view.getByPlaceholderText("Enter credit limit")).toBeTruthy();
  expect(view.getByPlaceholderText("Enter billing cycle in days")).toBeTruthy();
  expect(view.getByPlaceholderText("Enter default cut-off day")).toBeTruthy();
  expect(view.getByText("When your billing cycle ends each month. Enter 1-31; check your card statement.")).toBeTruthy();
  expect(view.getByPlaceholderText("Enter alert percentage")).toBeTruthy();
});

it("submits credit card details when creating a credit card account", async () => {
  const view = renderScreen();

  fireEvent.press(view.getByTestId("add-account"));
  fireEvent.changeText(view.getByPlaceholderText("Enter account name"), "Visa Platinum");
  fireEvent.press(view.getByLabelText("Credit Card"));
  fireEvent.changeText(view.getByPlaceholderText("Enter credit limit"), "25000");
  fireEvent.changeText(view.getByPlaceholderText("Enter billing cycle in days"), "30");
  fireEvent.changeText(view.getByPlaceholderText("Enter default cut-off day"), "15");
  fireEvent.changeText(view.getByPlaceholderText("Enter alert percentage"), "80");
  fireEvent.press(view.getByRole("button", { name: "Add Account" }));

  await waitFor(() => expect(mockCreateFinancialAccount).toHaveBeenCalledTimes(1));

  const [, , input] = mockCreateFinancialAccount.mock.calls[0];
  expect(input).toMatchObject({
    name: "Visa Platinum",
    kind: "credit_card",
    creditCardDetails: {
      creditLimitCentavos: 2500000,
      billingCycleDays: 30,
      cutoffDay: 15,
      alertThresholdPercent: 80,
    },
  });
});

it("shows per-field validation errors without submitting and keeps entered values", async () => {
  const view = renderScreen();

  fireEvent.press(view.getByTestId("add-account"));
  fireEvent.press(view.getByLabelText("Credit Card"));
  fireEvent.press(view.getByRole("button", { name: "Add Account" }));

  expect(view.getByText("Account name is required.")).toBeTruthy();
  expect(view.getByText("Credit limit is required.")).toBeTruthy();
  expect(view.getByText("Billing cycle is required.")).toBeTruthy();
  expect(view.getByText("Enter a valid cut-off day.")).toBeTruthy();
  expect(view.getByText("Alert threshold is required.")).toBeTruthy();
  expect(mockCreateFinancialAccount).not.toHaveBeenCalled();

  fireEvent.changeText(view.getByPlaceholderText("Enter account name"), "Keep Me");
  fireEvent.changeText(view.getByPlaceholderText("Enter credit limit"), "abc");
  fireEvent.changeText(view.getByPlaceholderText("Enter billing cycle in days"), "27");
  fireEvent.changeText(view.getByPlaceholderText("Enter default cut-off day"), "0");
  fireEvent.changeText(view.getByPlaceholderText("Enter alert percentage"), "120");
  expect(view.queryByText("Account name is required.")).toBeNull();

  fireEvent.press(view.getByRole("button", { name: "Add Account" }));

  expect(view.getByText("Credit limit must be a valid amount.")).toBeTruthy();
  expect(view.getByText("Billing cycle must be between 28 and 31 days.")).toBeTruthy();
  expect(view.getByText("Enter a valid cut-off day.")).toBeTruthy();
  expect(view.getByText("Alert threshold must be between 0 and 100.")).toBeTruthy();
  expect(mockCreateFinancialAccount).not.toHaveBeenCalled();

  fireEvent.changeText(view.getByPlaceholderText("Enter credit limit"), "5000");
  fireEvent.changeText(view.getByPlaceholderText("Enter billing cycle in days"), "30");
  fireEvent.changeText(view.getByPlaceholderText("Enter default cut-off day"), "10");
  fireEvent.changeText(view.getByPlaceholderText("Enter alert percentage"), "90");
  fireEvent.press(view.getByRole("button", { name: "Add Account" }));

  await waitFor(() => expect(mockCreateFinancialAccount).toHaveBeenCalledTimes(1));

  const [, , input] = mockCreateFinancialAccount.mock.calls[0];
  expect(input).toMatchObject({
    name: "Keep Me",
    creditCardDetails: {
      creditLimitCentavos: 500000,
      billingCycleDays: 30,
      cutoffDay: 10,
      alertThresholdPercent: 90,
    },
  });
});

it("keeps card fields hidden and omits card details for a bank account", async () => {
  const view = renderScreen();

  fireEvent.press(view.getByTestId("add-account"));

  expect(view.queryByPlaceholderText("Enter credit limit")).toBeNull();
  expect(view.getByLabelText("Bank")).toBeTruthy();

  fireEvent.changeText(view.getByPlaceholderText("Enter account name"), "Everyday Checking");
  fireEvent.press(view.getByRole("button", { name: "Add Account" }));

  await waitFor(() => expect(mockCreateFinancialAccount).toHaveBeenCalledTimes(1));

  const [, , input] = mockCreateFinancialAccount.mock.calls[0];
  expect(input).toMatchObject({ name: "Everyday Checking", kind: "bank" });
  expect(input.creditCardDetails).toBeUndefined();
});

it("groups credit cards separately and displays their credit limit", async () => {
  mockListFinancialAccounts.mockResolvedValue([
    {
      id: "bank-1",
      name: "Everyday Checking",
      kind: "bank",
      status: "active",
      openingBalanceCentavos: 100000,
      currentBalanceCentavos: 125000,
      includeInDashboardBalance: true,
      institutionName: null,
      openedOn: null,
      archivedAt: null,
      sortOrder: 0,
      creditCardDetails: null,
    },
    {
      id: "card-1",
      name: "Visa Platinum",
      kind: "credit_card",
      status: "active",
      openingBalanceCentavos: 0,
      currentBalanceCentavos: 0,
      includeInDashboardBalance: true,
      institutionName: null,
      openedOn: null,
      archivedAt: null,
      sortOrder: 1,
      creditCardDetails: {
        creditLimitCentavos: 2500000,
        availableCreditCentavos: 2500000,
        issuer: null,
        notes: null,
        billingCycleDays: 30,
        cutoffDay: 15,
        statementDay: null,
        alertThresholdPercent: 80,
      },
    },
  ]);

  const view = renderScreen();

  await waitFor(() => {
    expect(view.getByText("Categories")).toBeTruthy();
    expect(view.getByText("Credit Cards")).toBeTruthy();
    expect(view.getByText("₱25,000.00")).toBeTruthy();
  });
  expect(view.getByText("Available credit")).toBeTruthy();
});
