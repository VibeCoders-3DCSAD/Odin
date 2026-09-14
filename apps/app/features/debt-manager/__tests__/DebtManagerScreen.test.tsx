import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import DebtManagerScreen from "../DebtManagerScreen";

const mockListFinancialAccounts = jest.fn();
const mockReconcileCreditCardAvailableCredit = jest.fn();
const mockEnsureCurrentCreditCardCycles = jest.fn();
const mockListCreditCardCycles = jest.fn();
const mockListCreditCardCycleTransactions = jest.fn();
const mockListCreditCardStatements = jest.fn();
const mockCreateCreditCardStatement = jest.fn();
const mockListCreditCardInstallments = jest.fn();
const mockListCreditCardPayments = jest.fn();
const mockListCreditCardStrategies = jest.fn();
const mockRequestCreditCardSettlement = jest.fn();
const mockRecognizeCreditCardSettlement = jest.fn();
type ForecastSectionProps = {
  forecast: { points: Array<{ cycleId: string; targetCentavos: number }> } | null;
  isLoading: boolean;
};
const mockCreditCardForecastSection = jest.fn((_props: ForecastSectionProps) => null);
const mockDatePickerRef: { props: { onChange: (event: { type: string }, date?: Date) => void; minimumDate?: Date } | null } = { props: null };

jest.mock("../../../local-db/repositories/financialFoundations", () => ({
  listFinancialAccounts: (...args: unknown[]) => mockListFinancialAccounts(...args),
  reconcileCreditCardAvailableCredit: (...args: unknown[]) => mockReconcileCreditCardAvailableCredit(...args),
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
  listCreditCardStrategies: (...args: unknown[]) => mockListCreditCardStrategies(...args),
  saveCreditCardStrategy: jest.fn().mockResolvedValue(undefined),
  statementPaymentTargetCentavos: (statement: { statement_balance_centavos: number; minimum_due_centavos: number }, strategy: { strategy: string; customAmountCentavos: number | null; percentageBps: number | null }) => {
    if (strategy.strategy === "pay_in_full") return statement.statement_balance_centavos;
    if (strategy.strategy === "pay_minimum") return statement.minimum_due_centavos;
    if (strategy.strategy === "percentage_of_statement") return Math.round(statement.statement_balance_centavos * (strategy.percentageBps ?? 0) / 10_000);
    return strategy.customAmountCentavos;
  },
}));

jest.mock("../CreditCardForecastSection", () => {
  return (props: ForecastSectionProps) => mockCreditCardForecastSection(props);
});

jest.mock("../../../local-db/repositories/creditCardSettlements", () => ({
  listCreditCardSettlements: jest.fn().mockResolvedValue([]),
  requestCreditCardSettlement: (...args: unknown[]) => mockRequestCreditCardSettlement(...args),
  recognizeCreditCardSettlement: (...args: unknown[]) => mockRecognizeCreditCardSettlement(...args),
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
  mockListCreditCardStrategies.mockResolvedValue([]);
  mockCreditCardForecastSection.mockClear();
  mockCreateCreditCardStatement.mockResolvedValue({});
  mockDatePickerRef.props = null;
  mockReconcileCreditCardAvailableCredit.mockResolvedValue(undefined);
  mockRequestCreditCardSettlement.mockResolvedValue("settlement-1");
  mockRecognizeCreditCardSettlement.mockResolvedValue(undefined);
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

it("previews repayment strategy changes before saving", async () => {
  mockListFinancialAccounts.mockResolvedValue([{
    id: "card-1", name: "Visa", kind: "credit_card", status: "active", currentBalanceCentavos: 0, openingBalanceCentavos: 0,
    includeInDashboardBalance: false, institutionName: null, openedOn: null, archivedAt: null, sortOrder: 0,
    creditCardDetails: { creditLimitCentavos: 10_000_000, availableCreditCentavos: 7_000_000, issuer: null, notes: null, billingCycleDays: 31, cutoffDay: 4, statementDay: null, alertThresholdPercent: null, repaymentStrategy: null, repaymentCustomAmountCentavos: null, repaymentPercentageBps: null },
  }]);
  mockListCreditCardCycles.mockResolvedValue([{
    id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-08-05", cutoff_date: "2026-09-04", statement_date: "2026-09-04",
    version: 1, deleted: false, created_at: "2026-08-05T00:00:00.000Z", updated_at: "2026-08-05T00:00:00.000Z",
  }]);
  mockListCreditCardCycleTransactions.mockResolvedValue([{
    transaction_id: "transaction-1", account_id: "card-1", cycle_id: "cycle-1", purchase_type: "regular", installment_id: null,
    transaction_date: "2026-09-01", merchant_name: null, amount_centavos: 3_000_000,
  }]);
  mockListCreditCardStatements.mockResolvedValue([{
    id: "statement-1", user_id: "user-1", cycle_id: "cycle-1", statement_date: "2026-09-04", due_date: "2099-09-15",
    statement_balance_centavos: 3_000_000, minimum_due_centavos: 500_000, finance_charge_centavos: 0, authoritative: true,
    version: 1, deleted: false, created_at: "2026-09-04T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z",
  }]);
  const view = render(<DebtManagerScreen userId="user-1" deviceId="device-1" accountId="card-1" />);
  await waitFor(() => {
    const props = mockCreditCardForecastSection.mock.calls.at(-1)?.[0];
    expect(props?.forecast?.points.find((point) => point.cycleId.startsWith("forecast"))?.targetCentavos).toBe(3_000_000);
  });
  expect(mockCreditCardForecastSection.mock.calls.some(([props]) => props.isLoading)).toBe(true);

  fireEvent.press(view.getByRole("radio", { name: "Minimum Due" }));

  await waitFor(() => {
    const props = mockCreditCardForecastSection.mock.calls.at(-1)?.[0];
    expect(props?.forecast?.points.find((point) => point.cycleId.startsWith("forecast"))?.targetCentavos).toBe(500_000);
  });

  fireEvent.press(view.getByRole("radio", { name: "Percentage" }));
  fireEvent.changeText(view.getByLabelText("Repayment percentage"), "50");
  await waitFor(() => {
    const props = mockCreditCardForecastSection.mock.calls.at(-1)?.[0];
    expect(props?.forecast?.points.find((point) => point.cycleId.startsWith("forecast"))?.targetCentavos).toBe(1_500_000);
  });

  fireEvent.press(view.getByRole("radio", { name: "Custom" }));
  fireEvent.changeText(view.getByLabelText("Custom repayment amount"), "10000");
  await waitFor(() => {
    const props = mockCreditCardForecastSection.mock.calls.at(-1)?.[0];
    expect(props?.forecast?.points.find((point) => point.cycleId.startsWith("forecast"))?.targetCentavos).toBe(1_000_000);
  });
});

it("requires confirmation before reconciling issuer available credit", async () => {
  mockListFinancialAccounts.mockResolvedValue([{
    id: "card-1", name: "Visa", kind: "credit_card", status: "active", currentBalanceCentavos: 0, openingBalanceCentavos: 0,
    includeInDashboardBalance: false, institutionName: null, openedOn: null, archivedAt: null, sortOrder: 0,
    creditCardDetails: { creditLimitCentavos: 1_000_000, availableCreditCentavos: 750_000, issuer: "Bank", notes: null, billingCycleDays: 30, cutoffDay: 15, statementDay: null, alertThresholdPercent: null },
  }]);
  mockListCreditCardCycles.mockResolvedValue([{ id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-08-16", cutoff_date: "2026-09-15", statement_date: "2026-09-16", version: 1, deleted: false, created_at: "2026-08-16T00:00:00.000Z", updated_at: "2026-09-16T00:00:00.000Z" }]);
  mockListCreditCardStatements.mockResolvedValue([{ id: "statement-1", user_id: "user-1", cycle_id: "cycle-1", statement_date: "2026-09-16", due_date: "2099-09-30", statement_balance_centavos: 250_000, minimum_due_centavos: 50_000, finance_charge_centavos: 0, authoritative: true, version: 1, deleted: false, created_at: "2026-09-16T00:00:00.000Z", updated_at: "2026-09-16T00:00:00.000Z" }]);

  const view = render(<DebtManagerScreen userId="user-1" deviceId="device-1" accountId="card-1" />);
  await waitFor(() => expect(view.getByLabelText("Reconcile issuer available credit")).toBeTruthy());
  fireEvent.press(view.getByLabelText("Reconcile issuer available credit"));
  fireEvent.changeText(view.getByLabelText("Issuer available credit"), "8000");
  fireEvent.press(view.getByLabelText("Continue available credit reconciliation"));
  expect(mockReconcileCreditCardAvailableCredit).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText("Confirm available credit reconciliation"));
  await waitFor(() => expect(mockReconcileCreditCardAvailableCredit).toHaveBeenCalledWith("user-1", "device-1", "card-1", 800_000));
});

it("records issuer-reported principal and recognition for early settlement", async () => {
  mockListFinancialAccounts.mockResolvedValue([{ id: "card-1", name: "Visa", kind: "credit_card", status: "active", creditCardDetails: null }]);
  mockListCreditCardInstallments.mockResolvedValue([{ id: "installment-1", account_id: "card-1", description: "Laptop", original_principal_centavos: 100_000, remaining_principal_centavos: 60_000, term_months: 12, remaining_months: 6, monthly_amortization_centavos: 10_000, interest_type: "zero_interest", interest_rate_bps: 0, settlement_status: "active" }]);

  const view = render(<DebtManagerScreen userId="user-1" deviceId="device-1" accountId="card-1" />);
  await waitFor(() => expect(view.getByLabelText("Record early settlement for Laptop")).toBeTruthy());
  fireEvent.press(view.getByLabelText("Record early settlement for Laptop"));
  fireEvent.changeText(view.getByLabelText("Early settlement amount"), "5500");
  fireEvent.changeText(view.getByLabelText("Early settlement remaining principal"), "6000");
  fireEvent.press(view.getByLabelText("Save early settlement"));
  await waitFor(() => expect(mockRequestCreditCardSettlement).toHaveBeenCalledWith("user-1", "device-1", expect.objectContaining({ installmentId: "installment-1", remainingPrincipalCentavos: 600_000, settlementAmountCentavos: 550_000, preterminationFeeCentavos: 0 })));
  await waitFor(() => expect(mockRequestCreditCardSettlement).toHaveBeenCalled());
  expect(mockRecognizeCreditCardSettlement).not.toHaveBeenCalled();
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
