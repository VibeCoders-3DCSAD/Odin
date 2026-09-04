import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { CreditCardBillingCycles } from "../CreditCardBillingCycles";

jest.mock("react-native", () => {
  const React = require("react");
  const host = (name: string) => ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => React.createElement(name, props, children);
  return { ActivityIndicator: host("ActivityIndicator"), Pressable: host("Pressable"), Text: host("Text"), TextInput: host("TextInput"), View: host("View"), StyleSheet: { flatten: (value: unknown) => value } };
});

const mockCreateCycle = jest.fn(async () => ({ id: "cycle-2" }));
const mockRecordStatement = jest.fn(async () => ({ id: "statement-1" }));
const mockRecordPayment = jest.fn(async () => ({ paymentId: "payment-1" }));
jest.mock("../../../../local-db/repositories/creditCards", () => ({
  listCreditCards: jest.fn(async () => [{ accountId: "card-1", issuer: "Bank", creditLimitMinor: 100000, availableCreditMinor: 50000 }]),
  listCreditCardCycles: jest.fn(async () => [{ id: "cycle-1", cycleStartDate: "2026-09-01", cutoffDate: "2026-09-30", statementDate: "2026-10-05", statementBalanceMinor: 10000, paymentStatus: "unpaid" }]),
  listCreditCardCycleTransactions: jest.fn(async () => [{ id: "tx-1", transaction_type: "expense", transaction_date: "2026-09-03", amount_centavos: 12500, merchant_name: "Grocer", counterparty_name: null, purchase_type: "regular" }]),
  createCreditCardCycle: mockCreateCycle,
  recordCreditCardStatement: mockRecordStatement,
  recordCreditCardPayment: mockRecordPayment,
}));

test("shows billing cycles with transactions and other details", async () => {
  const view = render(<CreditCardBillingCycles userId="user-1" deviceId="device-1" />);

  await waitFor(() => expect(view.getByText("Bank")).toBeTruthy());
  expect(view.getByText("Sep 01 - Sep 30")).toBeTruthy();

  fireEvent.press(view.getByLabelText("Billing cycle Sep 01 - Sep 30"));

  await waitFor(() => expect(view.getByText("Grocer")).toBeTruthy());
  expect(view.getByText("TRANSACTIONS")).toBeTruthy();
  expect(view.getByText("OTHER DETAILS")).toBeTruthy();
  expect(view.getByText("Statement date: Oct 05")).toBeTruthy();
  expect(view.getByPlaceholderText("Enter statement balance")).toBeTruthy();
  expect(view.getByPlaceholderText("Enter minimum amount due")).toBeTruthy();
  expect(view.getByPlaceholderText("Enter finance charges or interest")).toBeTruthy();
  expect(view.getByPlaceholderText("Select due date")).toBeTruthy();
  expect(view.getByPlaceholderText("Enter payment amount")).toBeTruthy();
  expect(view.getByPlaceholderText("Select payment date")).toBeTruthy();
  expect(view.getByPlaceholderText("Add payment notes")).toBeTruthy();
  expect(view.getByLabelText("Record payment")).toBeTruthy();
});

test("provides an add billing cycle form", async () => {
  const view = render(<CreditCardBillingCycles userId="user-1" deviceId="device-1" />);
  await waitFor(() => expect(view.getByText("Bank")).toBeTruthy());

  fireEvent.press(view.getByLabelText("Add billing cycle for Bank"));
  expect(view.getByText("ADD BILLING CYCLE")).toBeTruthy();
  expect(view.getByText("Save billing cycle")).toBeTruthy();
});
