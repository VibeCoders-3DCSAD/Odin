import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import DebtManagerOverview from "../DebtManagerOverview";

const mockListFinancialAccounts = jest.fn();
const mockListDebtAccounts = jest.fn();
const mockListAllDebtPayments = jest.fn();
const mockListCreditCardCycles = jest.fn();
const mockListCreditCardCycleTransactions = jest.fn();
const mockListCreditCardStatements = jest.fn();
const mockListCreditCardPayments = jest.fn();
const mockListCreditCardInstallments = jest.fn();
const mockListCreditCardStrategies = jest.fn();

jest.mock("../../../local-db/repositories/financialFoundations", () => ({
  listFinancialAccounts: (...args: unknown[]) => mockListFinancialAccounts(...args),
}));
jest.mock("../../../local-db/repositories/debtAccounts", () => ({
  listDebtAccounts: (...args: unknown[]) => mockListDebtAccounts(...args),
}));
jest.mock("../../../local-db/repositories/debtPayments", () => ({
  listAllDebtPayments: (...args: unknown[]) => mockListAllDebtPayments(...args),
}));
jest.mock("../../../local-db/repositories/creditCardCycles", () => ({
  listCreditCardCycles: (...args: unknown[]) => mockListCreditCardCycles(...args),
  listCreditCardCycleTransactions: (...args: unknown[]) => mockListCreditCardCycleTransactions(...args),
}));
jest.mock("../../../local-db/repositories/creditCardStatements", () => ({
  listCreditCardStatements: (...args: unknown[]) => mockListCreditCardStatements(...args),
}));
jest.mock("../../../local-db/repositories/creditCardPayments", () => ({
  listCreditCardPayments: (...args: unknown[]) => mockListCreditCardPayments(...args),
}));
jest.mock("../../../local-db/repositories/creditCardInstallments", () => ({
  listCreditCardInstallments: (...args: unknown[]) => mockListCreditCardInstallments(...args),
}));
jest.mock("../../../local-db/repositories/creditCardRepaymentPlans", () => ({
  listCreditCardStrategies: (...args: unknown[]) => mockListCreditCardStrategies(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockListFinancialAccounts.mockResolvedValue([{
    id: "card-1", name: "Visa", kind: "credit_card", status: "active", creditCardDetails: {
      creditLimitCentavos: 10_000, availableCreditCentavos: 9_000, billingCycleDays: null,
    },
  }]);
  mockListDebtAccounts.mockImplementation((_userId: string, visibility: string) => Promise.resolve(visibility === "active" ? [{
    id: "debt-1", name: "Loan", type: "personal_loan", status: "active", currentBalanceCentavos: 2_000,
    originalBalanceCentavos: 5_000, minimumPaymentCentavos: 500, paymentFrequency: "monthly", nextDueDate: "2026-10-01",
    targetPayoffDate: "2027-01-01", annualInterestRateBps: 0, interestMethod: "no_interest", interestPeriod: "none",
    typeSpecific: { startDate: "2026-09-01", feesCentavos: 0, penaltyInfo: null, termMonths: null },
  }] : []));
  mockListAllDebtPayments.mockResolvedValue([{ debt_account_id: "debt-1", payment_date: "2026-09-10", amount_centavos: 300 }]);
  mockListCreditCardPayments.mockResolvedValue([{ cycle_id: "cycle-1", payment_date: "2026-09-11", amount_centavos: 500 }]);
  mockListCreditCardCycles.mockResolvedValue([{ id: "cycle-1", account_id: "card-1" }]);
  mockListCreditCardCycleTransactions.mockResolvedValue([]);
  mockListCreditCardStatements.mockResolvedValue([]);
  mockListCreditCardInstallments.mockResolvedValue([]);
  mockListCreditCardStrategies.mockResolvedValue([]);
});

it("shows debt paid, progress, and recorded payment trend alongside the total debt trend", async () => {
  const view = render(<DebtManagerOverview userId="user-1" onOpenCreditCards={jest.fn()} onOpenNonCreditDebts={jest.fn()} />);

  await waitFor(() => {
    expect(view.getByText("Debt paid")).toBeTruthy();
    expect(view.getByText("PHP 8.00")).toBeTruthy();
    expect(view.getByText("Overall progress")).toBeTruthy();
    expect(view.getByText("PHP 30.00 remaining")).toBeTruthy();
    expect(view.getByText("Payment trend")).toBeTruthy();
    expect(view.getByText("Date")).toBeTruthy();
    expect(view.getByText("Debt")).toBeTruthy();
    expect(view.getByText("Payment made")).toBeTruthy();
    expect(view.getByText("Loan")).toBeTruthy();
    expect(view.getByText("Visa")).toBeTruthy();
    expect(view.getByLabelText("2026-09-10, Loan, payment made PHP 3.00")).toBeTruthy();
    expect(view.getByText("Total debt trend")).toBeTruthy();
  });
});
