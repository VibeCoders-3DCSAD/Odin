import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import DebtManagerScreen from "../DebtManagerScreen";

const mockListFinancialAccounts = jest.fn();
const mockEnsureCurrentCreditCardCycles = jest.fn();
const mockListCreditCardCycles = jest.fn();
const mockListCreditCardCycleTransactions = jest.fn();
const mockListCreditCardStatements = jest.fn();
const mockCreateCreditCardStatement = jest.fn();
const mockListCreditCardInstallments = jest.fn();
const mockListCreditCardPayments = jest.fn();
const mockDatePickerRef: { props: { onChange: (event: { type: string }, date?: Date) => void; minimumDate?: Date } | null } = { props: null };

jest.mock("../../../local-db/repositories/financialFoundations", () => ({
  listFinancialAccounts: (...args: unknown[]) => mockListFinancialAccounts(...args),
}));

jest.mock("../../../local-db/repositories/creditCardCycles", () => ({
  ensureCurrentCreditCardCycles: (...args: unknown[]) => mockEnsureCurrentCreditCardCycles(...args),
  listCreditCardCycles: (...args: unknown[]) => mockListCreditCardCycles(...args),
  listCreditCardCycleTransactions: (...args: unknown[]) => mockListCreditCardCycleTransactions(...args),
}));

jest.mock("../../../local-db/repositories/creditCardStatements", () => ({
  listCreditCardStatements: (...args: unknown[]) => mockListCreditCardStatements(...args),
  createCreditCardStatement: (...args: unknown[]) => mockCreateCreditCardStatement(...args),
}));

jest.mock("../../../local-db/repositories/creditCardInstallments", () => ({
  listCreditCardInstallments: (...args: unknown[]) => mockListCreditCardInstallments(...args),
}));

jest.mock("../../../local-db/repositories/creditCardPayments", () => ({
  listCreditCardPayments: (...args: unknown[]) => mockListCreditCardPayments(...args),
  calculateCreditCardPaymentStatus: (amount: number, balance: number, minimum: number) => amount >= balance ? "fully_paid" : amount >= minimum ? "minimum_satisfied" : "partially_paid",
  creditBalanceCentavos: (amount: number, balance: number) => Math.max(0, amount - balance),
}));

jest.mock("../../../local-db/repositories/creditCardRepaymentPlans", () => ({
  listCreditCardStrategies: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../../local-db/repositories/creditCardSettlements", () => ({
  listCreditCardSettlements: jest.fn().mockResolvedValue([]),
}));

jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: (props: { onChange: (event: { type: string }, date?: Date) => void; minimumDate?: Date }) => {
    mockDatePickerRef.props = props;
    return null;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsureCurrentCreditCardCycles.mockResolvedValue([]);
  mockListCreditCardCycles.mockResolvedValue([]);
  mockListCreditCardCycleTransactions.mockResolvedValue([]);
  mockListCreditCardStatements.mockResolvedValue([]);
  mockListCreditCardInstallments.mockResolvedValue([]);
  mockListCreditCardPayments.mockResolvedValue([]);
  mockCreateCreditCardStatement.mockResolvedValue({});
  mockDatePickerRef.props = null;
  jest.restoreAllMocks();
});

it("opens native date pickers for a closed cycle statement", async () => {
  mockListFinancialAccounts.mockResolvedValue([{
    id: "card-1", name: "Visa", kind: "credit_card", status: "active", creditCardDetails: null,
  }]);
  mockListCreditCardCycles.mockResolvedValue([{
    id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-01-01", cutoff_date: "2026-01-31",
    statement_date: null, version: 1, deleted: false, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  }]);
  const view = render(<DebtManagerScreen userId="user-1" deviceId="device-1" accountId="card-1" />);
  await waitFor(() => expect(view.getByText("Add statement")).toBeTruthy());
  fireEvent.press(view.getByText("Add statement"));
  fireEvent.press(view.getByLabelText("Select statement date"));
  expect(mockDatePickerRef.props).not.toBeNull();
  expect(mockDatePickerRef.props?.minimumDate?.getFullYear()).toBe(2026);
  expect(mockDatePickerRef.props?.minimumDate?.getMonth()).toBe(0);
  expect(mockDatePickerRef.props?.minimumDate?.getDate()).toBe(31);
  act(() => mockDatePickerRef.props?.onChange({ type: "set" }, new Date("2026-02-01T00:00:00Z")));
  fireEvent.press(view.getByLabelText("Select due date"));
  expect(mockDatePickerRef.props).not.toBeNull();
});

it("lets the statement date be changed after it is selected", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  mockListFinancialAccounts.mockResolvedValue([{
    id: "card-1", name: "Visa", kind: "credit_card", status: "active", creditCardDetails: null,
  }]);
  mockListCreditCardCycles.mockResolvedValue([{
    id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-01-01", cutoff_date: "2026-01-31",
    statement_date: null, version: 1, deleted: false, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  }]);
  const view = render(<DebtManagerScreen userId="user-1" deviceId="device-1" accountId="card-1" />);
  await waitFor(() => expect(view.getByText("Add statement")).toBeTruthy());
  fireEvent.press(view.getByText("Add statement"));
  fireEvent.press(view.getByLabelText("Select statement date"));
  act(() => mockDatePickerRef.props?.onChange({ type: "set" }, new Date("2026-02-01T00:00:00Z")));
  expect(view.getByText("2026-02-01")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Select statement date"));
  act(() => mockDatePickerRef.props?.onChange({ type: "set" }, new Date("2026-02-02T00:00:00Z")));
  expect(view.getByText("2026-02-02")).toBeTruthy();
});

it("keeps the iOS statement-date picker open while the date spins", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  mockListFinancialAccounts.mockResolvedValue([{
    id: "card-1", name: "Visa", kind: "credit_card", status: "active", creditCardDetails: null,
  }]);
  mockListCreditCardCycles.mockResolvedValue([{
    id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-01-01", cutoff_date: "2026-01-31",
    statement_date: null, version: 1, deleted: false, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  }]);
  const view = render(<DebtManagerScreen userId="user-1" deviceId="device-1" accountId="card-1" />);
  await waitFor(() => expect(view.getByText("Add statement")).toBeTruthy());
  fireEvent.press(view.getByText("Add statement"));
  fireEvent.press(view.getByLabelText("Select statement date"));
  act(() => mockDatePickerRef.props?.onChange({ type: "set" }, new Date("2026-02-01T00:00:00Z")));
  expect(mockDatePickerRef.props).not.toBeNull();
  expect(view.getByText("2026-02-01")).toBeTruthy();
  act(() => mockDatePickerRef.props?.onChange({ type: "set" }, new Date("2026-02-02T00:00:00Z")));
  expect(mockDatePickerRef.props).not.toBeNull();
  expect(view.getByText("2026-02-02")).toBeTruthy();
});

it("identifies missing dates when otherwise valid statement amounts are entered", async () => {
  mockListFinancialAccounts.mockResolvedValue([{
    id: "card-1", name: "Visa", kind: "credit_card", status: "active", creditCardDetails: null,
  }]);
  mockListCreditCardCycles.mockResolvedValue([{
    id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-01-01", cutoff_date: "2026-01-31",
    statement_date: null, version: 1, deleted: false, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  }]);
  const view = render(<DebtManagerScreen userId="user-1" deviceId="device-1" accountId="card-1" />);
  await waitFor(() => expect(view.getByText("Add statement")).toBeTruthy());
  fireEvent.press(view.getByText("Add statement"));
  fireEvent.changeText(view.getByPlaceholderText("Enter statement balance"), "70000");
  fireEvent.changeText(view.getByPlaceholderText("Enter minimum amount due"), "25000");
  fireEvent.changeText(view.getByPlaceholderText("Enter amount, or leave blank"), "0");
  fireEvent.press(view.getByRole("button", { name: "Record statement" }));
  await waitFor(() => {
    expect(view.getByText("Statement date is required.")).toBeTruthy();
    expect(view.getByText("Due date is required.")).toBeTruthy();
  });
});

it("shows the requirements-aligned empty card message", async () => {
  mockListFinancialAccounts.mockResolvedValue([]);
  const view = render(<DebtManagerScreen userId="user-1" deviceId="device-1" accountId="card-1" />);
  await waitFor(() => expect(view.getByText("No credit cards are recorded yet. Add a credit card to track billing cycles and payments.")).toBeTruthy());
});

it("shows card details and all current cycle dates", async () => {
  mockListFinancialAccounts.mockResolvedValue([{
    id: "card-1",
    name: "Visa Platinum",
    kind: "credit_card",
    status: "active",
    institutionName: "Bank",
    currentBalanceCentavos: 0,
    openingBalanceCentavos: 0,
    includeInDashboardBalance: false,
    archivedAt: null,
    openedOn: null,
    sortOrder: 0,
    creditCardDetails: {
      creditLimitCentavos: 2500000,
      availableCreditCentavos: 2000000,
      issuer: "Bank",
      notes: null,
      billingCycleDays: 30,
      cutoffDay: 15,
      statementDay: 5,
      alertThresholdPercent: 80,
    },
  }]);
  mockListCreditCardCycles.mockResolvedValue([{
    id: "cycle-1",
    user_id: "user-1",
    account_id: "card-1",
    cycle_start_date: "2024-01-16",
    cutoff_date: "2024-02-15",
    statement_date: "2024-02-20",
    version: 1,
    deleted: false,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  }]);

    const view = render(<DebtManagerScreen userId="user-1" deviceId="device-1" accountId="card-1" />);
    await waitFor(() => {
      expect(view.getByText("Billing cycles and statement activity")).toBeTruthy();
      expect(view.getByText("Billing Cycles")).toBeTruthy();
      expect(view.getAllByText("Visa Platinum")).toHaveLength(2);
    expect(view.getByText("Cycle start: 2024-01-16")).toBeTruthy();
    expect(view.getByText("Cutoff: 2024-02-15")).toBeTruthy();
    expect(view.getByText("Statement: 2024-02-20")).toBeTruthy();
  });
});

it("keeps the card visible when current-cycle generation fails", async () => {
  mockListFinancialAccounts.mockResolvedValue([{
    id: "card-1",
    name: "Visa Platinum",
    kind: "credit_card",
    status: "active",
    creditCardDetails: null,
  }]);
  mockEnsureCurrentCreditCardCycles.mockRejectedValue(new Error("cycle constraint"));

  const view = render(<DebtManagerScreen userId="user-1" deviceId="device-1" accountId="card-1" />);
  await waitFor(() => {
    expect(view.getByText("Visa Platinum")).toBeTruthy();
    expect(view.getByText("Credit-card information may be out of date. Refresh or reconcile it with the latest issuer records.")).toBeTruthy();
  });
});

it("shows current-cycle credit-card transactions", async () => {
  mockListFinancialAccounts.mockResolvedValue([{
    id: "card-1",
    name: "Visa Platinum",
    kind: "credit_card",
    status: "active",
    creditCardDetails: null,
  }]);
  mockListCreditCardCycles.mockResolvedValue([{
    id: "cycle-1",
    user_id: "user-1",
    account_id: "card-1",
    cycle_start_date: "2024-01-16",
    cutoff_date: "2024-02-15",
    statement_date: null,
    version: 1,
    deleted: false,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  }]);
  mockListCreditCardCycleTransactions.mockResolvedValue([{
    transaction_id: "tx-1",
    account_id: "card-1",
    cycle_id: "cycle-1",
    purchase_type: "regular",
    transaction_date: "2024-02-01",
    merchant_name: "Grocery Store",
    amount_centavos: 125000,
  }]);

  const view = render(<DebtManagerScreen userId="user-1" deviceId="device-1" accountId="card-1" />);
  await waitFor(() => {
    expect(view.getByText("Grocery Store")).toBeTruthy();
    expect(view.getByText("₱1,250.00")).toBeTruthy();
    expect(view.getByText("2024-02-01 · Regular purchase")).toBeTruthy();
  });
});

it("keeps transactions from a prior billing cycle visible", async () => {
  const today = new Date().toISOString().slice(0, 10);
  mockListFinancialAccounts.mockResolvedValue([{
    id: "card-1",
    name: "Visa Platinum",
    kind: "credit_card",
    status: "active",
    creditCardDetails: null,
  }]);
  mockListCreditCardCycles.mockResolvedValue([
    {
      id: "cycle-prior",
      user_id: "user-1",
      account_id: "card-1",
      cycle_start_date: "2026-08-05",
      cutoff_date: "2026-09-04",
      statement_date: null,
      version: 1,
      deleted: false,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "cycle-current",
      user_id: "user-1",
      account_id: "card-1",
      cycle_start_date: "2020-01-01",
      cutoff_date: "2099-12-31",
      statement_date: null,
      version: 1,
      deleted: false,
      created_at: "2020-01-01T00:00:00.000Z",
      updated_at: "2020-01-01T00:00:00.000Z",
    },
  ]);
  mockListCreditCardCycleTransactions.mockResolvedValue([{
    transaction_id: "tx-1",
    account_id: "card-1",
    cycle_id: "cycle-prior",
    purchase_type: "regular",
    transaction_date: today,
    merchant_name: "Prior cycle purchase",
    amount_centavos: 125000,
  }]);

  const view = render(<DebtManagerScreen userId="user-1" deviceId="device-1" accountId="card-1" />);
  await waitFor(() => expect(view.getByText("Prior cycle purchase")).toBeTruthy());
});
