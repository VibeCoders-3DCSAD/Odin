import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import DebtManagerOverview from "../DebtManagerOverview";

const mockListFinancialAccounts = jest.fn(); const mockListDebtAccounts = jest.fn(); const mockArchiveDebtAccount = jest.fn(); const mockMarkDebtAccountDeleted = jest.fn();
jest.mock("../../../local-db/repositories/financialFoundations", () => ({ listFinancialAccounts: (...args: unknown[]) => mockListFinancialAccounts(...args) }));
jest.mock("../../../local-db/repositories/debtAccounts", () => ({ listDebtAccounts: (...args: unknown[]) => mockListDebtAccounts(...args), archiveDebtAccount: (...args: unknown[]) => mockArchiveDebtAccount(...args), markDebtAccountDeleted: (...args: unknown[]) => mockMarkDebtAccountDeleted(...args) }));

const debt = { id: "debt-1", name: "Car loan", lenderName: "Bank A", type: "auto_loan", status: "active", progress: "no_payments", originalBalanceCentavos: 500000, currentBalanceCentavos: 450000, annualInterestRateBps: 650, minimumPaymentCentavos: 15000, paymentFrequency: "monthly", nextDueDate: "2026-10-01", maturityDate: null, targetPayoffDate: null, interestPeriod: "annual", interestMethod: "diminishing_balance", notes: null, typeSpecific: { startDate: "2026-01-01", feesCentavos: 0, penaltyInfo: null, termMonths: null }, hasPaymentHistory: false, archivedAt: null, paidOffAt: null, version: 1 };
describe("DebtManagerOverview non-credit-card debts", () => {
  beforeEach(() => { jest.clearAllMocks(); mockListFinancialAccounts.mockResolvedValue([]); mockListDebtAccounts.mockResolvedValue([debt]); });
  it("shows non-credit-card debts separately from credit cards", async () => { const view = render(<DebtManagerOverview userId="user-1" deviceId="device-1" onOpenCreditCards={jest.fn()} />); expect(await view.findByText("Non-credit-card debts")).toBeTruthy(); expect(view.getAllByText("Car loan")).toHaveLength(2); expect(view.getAllByText("No payments recorded yet.")).toHaveLength(2); });
  it("archives debt after explicit confirmation", async () => { mockArchiveDebtAccount.mockResolvedValue({ debt: { ...debt, status: "archived" } }); const view = render(<DebtManagerOverview userId="user-1" deviceId="device-1" onOpenCreditCards={jest.fn()} />); await view.findByText("Non-credit-card debts"); fireEvent.press(view.getByText("Archive debt")); fireEvent.press(view.getByText("Confirm archive")); await waitFor(() => expect(mockArchiveDebtAccount).toHaveBeenCalledWith("user-1", "device-1", "debt-1")); });
});
