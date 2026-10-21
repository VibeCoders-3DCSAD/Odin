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
const mockGetSavingsDetails = jest.fn();
const mockUpsertSavingsDetails = jest.fn();

jest.mock("../../../local-db/repositories/savingsAccountDetails", () => ({
  ...jest.requireActual("../../../local-db/repositories/savingsAccountDetails"),
  getSavingsAccountDetails: (...args: unknown[]) => mockGetSavingsDetails(...args),
  upsertSavingsAccountDetails: (...args: unknown[]) => mockUpsertSavingsDetails(...args),
}));
jest.mock("../../../local-db/repositories/savingsGoalAccounts", () => ({
  getSavingsGoalAccount: jest.fn().mockResolvedValue({ id: "savings-new", name: "Rainy day", kind: "savings", status: "active" }),
  listActiveSavingsGoalAccounts: jest.fn().mockResolvedValue([]),
}));

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
  mockGetSavingsDetails.mockResolvedValue(null);
  mockUpsertSavingsDetails.mockResolvedValue({});
});

it("shows credit card fields only when the Credit Card kind is selected", async () => {
  const view = renderScreen();

  fireEvent.press(await view.findByTestId("add-account"));

  expect(view.queryByPlaceholderText("Enter credit limit")).toBeNull();

  fireEvent.press(view.getByLabelText("Credit Card"));

  expect(view.getByPlaceholderText("Enter credit limit")).toBeTruthy();
  expect(view.queryByPlaceholderText("Enter billing cycle in days")).toBeNull();
  expect(view.getByPlaceholderText("Enter billing cycle end day")).toBeTruthy();
  expect(view.getByText("Your bank may call this the cut-off date. Enter the day your billing cycle ends each month (1-31).")).toBeTruthy();
  expect(view.getByPlaceholderText("Enter alert percentage")).toBeTruthy();
});

it("submits credit card details when creating a credit card account", async () => {
  const view = renderScreen();

  fireEvent.press(await view.findByTestId("add-account"));
  fireEvent.changeText(view.getByPlaceholderText("Enter account name"), "Visa Platinum");
  fireEvent.press(view.getByLabelText("Credit Card"));
  fireEvent.changeText(view.getByPlaceholderText("Enter credit limit"), "25000");
  fireEvent.changeText(view.getByPlaceholderText("Enter billing cycle end day"), "15");
  fireEvent.changeText(view.getByPlaceholderText("Enter alert percentage"), "80");
  fireEvent.press(view.getByRole("button", { name: "Add Account" }));

  await waitFor(() => expect(mockCreateFinancialAccount).toHaveBeenCalledTimes(1));

  const [, , input] = mockCreateFinancialAccount.mock.calls[0];
  expect(input).toMatchObject({
    name: "Visa Platinum",
    kind: "credit_card",
    creditCardDetails: {
      creditLimitCentavos: 2500000,
      cutoffDay: 15,
      alertThresholdPercent: 80,
    },
  });
});

it("shows per-field validation errors without submitting and keeps entered values", async () => {
  const view = renderScreen();

  fireEvent.press(await view.findByTestId("add-account"));
  fireEvent.press(view.getByLabelText("Credit Card"));
  fireEvent.press(view.getByRole("button", { name: "Add Account" }));

  expect(view.getByText("Account name is required.")).toBeTruthy();
  expect(view.getByText("Credit limit is required.")).toBeTruthy();
  expect(view.getByText("Enter a valid cut-off day.")).toBeTruthy();
  expect(view.getByText("Alert threshold is required.")).toBeTruthy();
  expect(mockCreateFinancialAccount).not.toHaveBeenCalled();

  fireEvent.changeText(view.getByPlaceholderText("Enter account name"), "Keep Me");
  fireEvent.changeText(view.getByPlaceholderText("Enter credit limit"), "abc");
  fireEvent.changeText(view.getByPlaceholderText("Enter billing cycle end day"), "0");
  fireEvent.changeText(view.getByPlaceholderText("Enter alert percentage"), "120");
  expect(view.queryByText("Account name is required.")).toBeNull();

  fireEvent.press(view.getByRole("button", { name: "Add Account" }));

  expect(view.getByText("Credit limit must be a valid amount.")).toBeTruthy();
  expect(view.getByText("Enter a valid cut-off day.")).toBeTruthy();
  expect(view.getByText("Alert threshold must be between 0 and 100.")).toBeTruthy();
  expect(mockCreateFinancialAccount).not.toHaveBeenCalled();

  fireEvent.changeText(view.getByPlaceholderText("Enter credit limit"), "5000");
  fireEvent.changeText(view.getByPlaceholderText("Enter billing cycle end day"), "10");
  fireEvent.changeText(view.getByPlaceholderText("Enter alert percentage"), "90");
  fireEvent.press(view.getByRole("button", { name: "Add Account" }));

  await waitFor(() => expect(mockCreateFinancialAccount).toHaveBeenCalledTimes(1));

  const [, , input] = mockCreateFinancialAccount.mock.calls[0];
  expect(input).toMatchObject({
    name: "Keep Me",
    creditCardDetails: {
      creditLimitCentavos: 500000,
      cutoffDay: 10,
      alertThresholdPercent: 90,
    },
  });
});

it("keeps card fields hidden and omits card details for a bank account", async () => {
  const view = renderScreen();

  fireEvent.press(await view.findByTestId("add-account"));

  expect(view.queryByPlaceholderText("Enter credit limit")).toBeNull();
  expect(view.getByLabelText("Bank")).toBeTruthy();

  fireEvent.changeText(view.getByPlaceholderText("Enter account name"), "Everyday Checking");
  fireEvent.press(view.getByRole("button", { name: "Add Account" }));

  await waitFor(() => expect(mockCreateFinancialAccount).toHaveBeenCalledTimes(1));

  const [, , input] = mockCreateFinancialAccount.mock.calls[0];
  expect(input).toMatchObject({ name: "Everyday Checking", kind: "bank" });
  expect(input.creditCardDetails).toBeUndefined();
});

it("lists credit cards with their available credit", async () => {
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
    expect(view.getByText("Visa Platinum")).toBeTruthy();
    expect(view.getByText("PHP 25,000.00")).toBeTruthy();
  });
  expect(view.getByText("Available credit")).toBeTruthy();

  fireEvent.press(view.getByLabelText("Visa Platinum account actions"));

  expect(view.getByRole("button", { name: "Edit" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Delete" })).toBeTruthy();
});


const savingsAccount = {
  id: "savings-new", name: "Rainy day", kind: "savings", status: "active",
  openingBalanceCentavos: 0, currentBalanceCentavos: 0, includeInDashboardBalance: true,
  institutionName: null, openedOn: null, archivedAt: null, sortOrder: 0, creditCardDetails: null,
};

it("offers the five account types without a Savings choice", async () => {
  const view = renderScreen();
  fireEvent.press(await view.findByTestId("add-account"));
  for (const label of ["Cash", "Bank", "E-Wallet", "Credit Card", "Other"]) expect(view.getByRole("radio", { name: label })).toBeTruthy();
  expect(view.queryByRole("radio", { name: "Savings" })).toBeNull();
});

async function editExistingSavingsAccount() {
  mockListFinancialAccounts.mockResolvedValue([savingsAccount]);
  const view = renderScreen();
  fireEvent.press(await view.findByLabelText("Rainy day account actions"));
  fireEvent.press(view.getByRole("button", { name: "Edit" }));
  fireEvent.press(view.getByLabelText("Advanced interest options"));
  await waitFor(() => expect(view.getByLabelText("Interest rate")).toBeTruthy());
  return view;
}

it.each(["personal_savings", "high_yield_savings"])("edits legacy %s in the shared account sheet while preserving its schedule", async (accountType) => {
  const schedule = { plannedContributionAmountCentavos: 50000, contributionFrequency: "monthly", contributionIntervalCount: 1, contributionDayOfMonth: 15, contributionSecondDayOfMonth: null, contributionDayOfWeek: null, customIntervalDays: null, nextContributionDate: "2027-01-15" };
  mockListFinancialAccounts.mockResolvedValue([savingsAccount]);
  mockGetSavingsDetails.mockResolvedValue({
    accountId: savingsAccount.id, version: 1, accountType, interestRateBps: accountType === "personal_savings" ? 100 : null, minimumBalanceCentavos: 0,
    baseInterestRateBps: accountType === "high_yield_savings" ? 100 : null, effectiveInterestRateBps: null, interestConditions: null, higherRateEligible: null,
    boostedInterestRateBps: null, interestCalculationBasis: accountType === "high_yield_savings" ? "daily_ending_balance" : null, interestCreditFrequency: accountType === "high_yield_savings" ? "monthly" : null,
    maximumEligibleBalanceCentavos: null, balanceTiers: null, requiredDepositCentavos: null,
    requiredDepositFrequency: null, requiredTransactionCount: null, requiredTransactionPeriod: null,
    directDepositThresholdCentavos: null, qualificationPeriod: null, promotionalInterestRateBps: null,
    promotionStartDate: null, promotionEndDate: null, principalCentavos: null, maturityDate: null,
    termMonths: null, earlyWithdrawalRule: null, interestReference: { balanceBasis: "daily_balance", method: "simple", rateStructure: "fixed", notes: "Bank disclosure" }, ...schedule,
  });
  const view = renderScreen();
  fireEvent.press(await view.findByLabelText("Rainy day account actions"));
  fireEvent.press(view.getByRole("button", { name: "Edit" }));
  fireEvent.press(view.getByLabelText("Advanced interest options"));
  await waitFor(() => expect(view.getByPlaceholderText("Enter interest rate").props.value).toBe("1"));
  expect(view.getByLabelText("Interest behavior: Simple Interest").props.accessibilityState.checked).toBe(true);
  expect(view.getByLabelText("Interest notes").props.value).toBe("Bank disclosure");
  expect(view.queryByRole("radio", { name: "Savings" })).toBeNull();
  expect(view.getByText("Savings (existing account)")).toBeTruthy();
  expect(view.queryByText("PLANNED CONTRIBUTION (₱)")).toBeNull();
  fireEvent.press(view.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(mockUpsertSavingsDetails).toHaveBeenCalledWith("test-user", "test-device", "savings-new", expect.objectContaining(schedule)));
  expect(view.queryByText("Do you want to add a goal?")).toBeNull();
});

it("saves fixed interest settings on an existing Savings account after collapsing Advanced Options", async () => {
  const view = await editExistingSavingsAccount();
  fireEvent.changeText(view.getByLabelText("Interest rate"), "4");
  fireEvent.press(view.getByLabelText("Calculation basis: Average Daily Balance (ADB)"));
  fireEvent.changeText(view.getByLabelText("Interest notes"), "  Bank disclosure  ");
  fireEvent.press(view.getByLabelText("Advanced interest options"));
  expect(view.queryByText("Calculation basis")).toBeNull();
  fireEvent.press(view.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(mockUpsertSavingsDetails).toHaveBeenCalledWith("test-user", "test-device", "savings-new", expect.objectContaining({
    interestRateBps: 400, minimumBalanceCentavos: null,
    interestReference: expect.objectContaining({ balanceBasis: "average_daily_balance", method: "compound", rateStructure: "fixed", notes: "Bank disclosure", configuration: expect.objectContaining({ withholdingTaxBps: 2000, creditFrequency: "monthly", autoProject: false }) }),
  })));
});

it("blocks malformed rates before updating an existing savings account", async () => {
  const view = await editExistingSavingsAccount();
  fireEvent.changeText(view.getByLabelText("Interest rate"), "-2");
  fireEvent.press(view.getByRole("button", { name: "Save Changes" }));
  expect(view.getByText("Enter a valid annual interest rate with up to two decimal places.")).toBeTruthy();
  expect(mockUpdateFinancialAccount).not.toHaveBeenCalled();
});
