import { fireEvent, render, waitFor } from "@testing-library/react-native";
import CreditCardsScreen from "../CreditCardsScreen";

jest.mock("react-native", () => {
  const React = require("react");
  const host = (name: string) => ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => React.createElement(name, props, children);
  return {
  ActivityIndicator: host("ActivityIndicator"), Pressable: host("Pressable"), Text: host("Text"), TextInput: host("TextInput"), View: host("View"),
  StyleSheet: { flatten: (value: unknown) => value },
  };
});

const mockActions = {
  saveCreditCard: jest.fn(), createCreditCardCycle: jest.fn(), recordCreditCardStatement: jest.fn(),
  recordCreditCardPayment: jest.fn(), setCreditCardStatementStrategy: jest.fn(), applyCreditCardBalance: jest.fn(),
  recognizeCreditCardPayment: jest.fn(), requestCreditCardSettlement: jest.fn(async () => "settlement-1"), recognizeCreditCardSettlement: jest.fn(),
};
jest.mock("../../../local-db/repositories/creditCards", () => ({
  ...mockActions,
  listCreditCards: jest.fn(async () => [{ accountId: "card-1", issuer: "Bank", creditLimitMinor: 100000, availableCreditMinor: 50000, defaultCutoffDate: "2026-09-15", defaultStatementDate: "2026-09-20", notes: null }]),
  getCreditCard: jest.fn(async () => ({ accountId: "card-1", issuer: "Bank", creditLimitMinor: 100000, availableCreditMinor: 50000, defaultCutoffDate: "2026-09-15", defaultStatementDate: "2026-09-20", notes: null })),
  listCreditCardCycles: jest.fn(async () => [{ id: "cycle-1", cycleStartDate: "2026-09-01", cutoffDate: "2026-09-15", statementDate: "2026-09-20", statementId: "statement-1", statementBalanceMinor: 10000, minimumDueMinor: 1000, financeChargeMinor: 0, dueDate: "2026-10-01", paidMinor: 0, paymentStatus: "unpaid", creditBalanceMinor: 0, strategy: null }]),
  listCreditCardPayments: jest.fn(async () => [{ id: "payment-1", amountMinor: 5000, paymentDate: "2026-09-03", issuerRecognized: false }]),
  listCreditCardCycleTransactions: jest.fn(async () => [{ id: "transaction-1", transaction_date: "2026-09-02", amount_centavos: 2500, merchant_name: "Grocer", counterparty_name: null, purchase_type: "regular" }]),
  listCreditCardSettlements: jest.fn(async () => [{ id: "settlement-1", installmentId: "installment-1", settlementDate: "2026-09-03", settlementAmountMinor: 5000, status: "requested" }]),
  listCreditCardInstallments: jest.fn(async () => [{ id: "installment-1", accountId: "card-1", transactionId: "tx-1", description: "Phone", originalPrincipalMinor: 10000, remainingPrincipalMinor: 5000, termMonths: 4, remainingMonths: 2, monthlyAmortizationMinor: 2500, interestRateBps: 0, interestType: "zero_interest", settlementStatus: "active" }]),
}));
jest.mock("../../../local-db/repositories/financialFoundations", () => ({ listFinancialAccounts: jest.fn(async () => []) }));

test("requires selecting a cycle before showing lifecycle controls", async () => {
  const view = render(<CreditCardsScreen userId="user-1" deviceId="device-1" cardId="card-1" />);
  await waitFor(() => expect(view.getByText("Bank")).toBeTruthy());
  expect(view.queryByLabelText("Record authoritative statement")).toBeNull();
  fireEvent.press(view.getByLabelText("Select cycle cycle-1"));
  await waitFor(() => expect(view.getByLabelText("Record authoritative statement")).toBeTruthy());
  expect(view.getByText(/Minimum due/)).toBeTruthy();
  expect(view.getByText(/Credit balance/)).toBeTruthy();
});

test("uses loaded records for recognition and credit application selectors", async () => {
  const view = render(<CreditCardsScreen userId="user-1" deviceId="device-1" cardId="card-1" />);
  await waitFor(() => expect(view.getByText("Bank")).toBeTruthy());
  fireEvent.press(view.getByLabelText("Select cycle cycle-1"));
  await waitFor(() => expect(view.getByLabelText("Select payment to recognize payment-1")).toBeTruthy());

  fireEvent.press(view.getByLabelText("Select payment to recognize payment-1"));
  fireEvent.press(view.getByLabelText("Select target charge transaction-1"));
  await waitFor(() => expect(view.getByText(/● .*PHP 50\.00/)).toBeTruthy());
  expect(view.getByLabelText("Recognize issuer payment")).toBeTruthy();
  expect(view.getByLabelText("Select settlement to recognize settlement-1")).toBeTruthy();
  expect(view.queryByPlaceholderText("Payment ID to recognize")).toBeNull();
  expect(view.queryByPlaceholderText("Target charge transaction ID (optional)")).toBeNull();
});
