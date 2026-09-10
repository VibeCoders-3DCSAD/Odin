import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import NonCreditDebtListScreen from "../NonCreditDebtListScreen";

const mockListDebtAccounts = jest.fn();
const mockGetDebtStrategy = jest.fn();
const mockSaveDebtStrategy = jest.fn();

jest.mock("../../../local-db/repositories/debtAccounts", () => ({ listDebtAccounts: (...args: unknown[]) => mockListDebtAccounts(...args) }));
jest.mock("../../../local-db/repositories/debtRepaymentPlans", () => ({ getDebtStrategy: (...args: unknown[]) => mockGetDebtStrategy(...args), saveDebtStrategy: (...args: unknown[]) => mockSaveDebtStrategy(...args) }));

const debt = { id: "debt-1", name: "Car loan", lenderName: "Bank A", type: "auto_loan", status: "active", progress: "no_payments", originalBalanceCentavos: 500000, currentBalanceCentavos: 450000, annualInterestRateBps: 650, minimumPaymentCentavos: 15000, paymentFrequency: "monthly", nextDueDate: "2026-10-01", maturityDate: null, targetPayoffDate: null, interestPeriod: "annual", interestMethod: "diminishing_balance", notes: null, typeSpecific: { startDate: "2026-01-01", feesCentavos: 0, penaltyInfo: null, termMonths: null }, hasPaymentHistory: false, archivedAt: null, paidOffAt: null, version: 1 };

describe("NonCreditDebtListScreen", () => {
  beforeEach(() => { jest.clearAllMocks(); mockListDebtAccounts.mockResolvedValue([debt]); mockGetDebtStrategy.mockResolvedValue("avalanche"); mockSaveDebtStrategy.mockResolvedValue(undefined); });

  it("shows filters, the global strategy, and selectable debts", async () => {
    const onOpenDebt = jest.fn();
    const view = render(<NonCreditDebtListScreen userId="user-1" deviceId="device-1" onBack={jest.fn()} onOpenDebt={onOpenDebt} />);
    expect(await view.findByText("Global repayment strategy")).toBeTruthy();
    expect(view.getByLabelText("Show active debts")).toBeTruthy();
    expect(view.getByLabelText("Show finished debts")).toBeTruthy();
    expect(view.getByLabelText("Show archived debts")).toBeTruthy();
    expect(view.getByLabelText("Show deleted debts")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Open Car loan"));
    expect(onOpenDebt).toHaveBeenCalledWith("debt-1");
  });

  it("loads the requested status filter", async () => {
    const view = render(<NonCreditDebtListScreen userId="user-1" deviceId="device-1" onBack={jest.fn()} onOpenDebt={jest.fn()} />);
    await view.findByText("Car loan");
    fireEvent.press(view.getByLabelText("Show finished debts"));
    await waitFor(() => expect(mockListDebtAccounts).toHaveBeenLastCalledWith("user-1", "finished"));
  });

  it("saves the global repayment strategy", async () => {
    const view = render(<NonCreditDebtListScreen userId="user-1" deviceId="device-1" onBack={jest.fn()} onOpenDebt={jest.fn()} />);
    await view.findByText("Snowball");
    fireEvent.press(view.getByText("Snowball"));
    await waitFor(() => expect(mockSaveDebtStrategy).toHaveBeenCalledWith("user-1", "device-1", "snowball"));
  });
});
