import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import NonCreditDebtForm from "../NonCreditDebtForm";
import type { DebtAccount } from "../../../../../local-db/repositories/debts/debtAccounts";

const mockCreateDebtAccount = jest.fn();
const mockUpdateDebtAccount = jest.fn();
jest.mock("../../../../../local-db/repositories/debts/debtAccounts", () => ({
  createDebtAccount: (...args: unknown[]) => mockCreateDebtAccount(...args),
  updateDebtAccount: (...args: unknown[]) => mockUpdateDebtAccount(...args),
}));
jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");

function pickDate(view: ReturnType<typeof render>, label: string, date: Date) {
  fireEvent.press(view.getByLabelText(label));
  fireEvent(view.UNSAFE_getByType(DateTimePicker), "onChange", { type: "set" }, date);
  fireEvent.press(view.getByLabelText("Done"));
}

describe("NonCreditDebtForm", () => {
  beforeEach(() => { mockCreateDebtAccount.mockReset(); mockUpdateDebtAccount.mockReset(); });
  it("validates required fields before creating a debt", () => {
    const view = render(<NonCreditDebtForm userId="user-1" deviceId="device-1" onCancel={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.press(view.getByText("Save debt"));
    expect(view.getByText("Some debt details are not valid. Check the highlighted fields and try again.")).toBeTruthy();
    expect(mockCreateDebtAccount).not.toHaveBeenCalled();
    expect(view.getByText("Debt name is required.")).toBeTruthy();
  });
  it("shows debt type choices as selectable radios and updates the active choice", () => {
    const view = render(<NonCreditDebtForm userId="user-1" deviceId="device-1" onCancel={jest.fn()} onSaved={jest.fn()} />);

    const personalLoan = view.getByRole("radio", { name: "Select Personal Loan" });
    const autoLoan = view.getByRole("radio", { name: "Select Auto Loan" });
    expect(personalLoan.props.accessibilityState).toEqual({ selected: true });
    expect(autoLoan.props.accessibilityState).toEqual({ selected: false });

    fireEvent.press(autoLoan);

    expect(view.getByRole("radio", { name: "Select Personal Loan" }).props.accessibilityState).toEqual({ selected: false });
    expect(view.getByRole("radio", { name: "Select Auto Loan" }).props.accessibilityState).toEqual({ selected: true });
  });
  it("creates a personal loan with the common debt fields", async () => {
    mockCreateDebtAccount.mockResolvedValue({ debt: { id: "debt-1", name: "Emergency loan" } });
    const onSaved = jest.fn(); const view = render(<NonCreditDebtForm userId="user-1" deviceId="device-1" onCancel={jest.fn()} onSaved={onSaved} />);
    fireEvent.changeText(view.getByPlaceholderText("Enter debt name"), "Emergency loan"); fireEvent.changeText(view.getByPlaceholderText("Enter lender name"), "Bank A"); fireEvent.changeText(view.getByPlaceholderText("Enter original amount"), "1000"); fireEvent.changeText(view.getByPlaceholderText("Enter current balance"), "1000"); fireEvent.changeText(view.getByPlaceholderText("Enter payment amount"), "100"); fireEvent.changeText(view.getByLabelText("Due day"), "1"); pickDate(view, "Pay off by", new Date(2099, 6, 1)); fireEvent.press(view.getByText("Save debt"));
    await waitFor(() => expect(mockCreateDebtAccount).toHaveBeenCalledWith("user-1", "device-1", expect.objectContaining({ name: "Emergency loan", originalBalanceCentavos: 100000, currentBalanceCentavos: 100000, minimumPaymentCentavos: 10000, paymentFrequency: "monthly", nextDueDate: expect.stringMatching(/^\d{4}-\d{2}-01$/), targetPayoffDate: "2099-07-01" })));
    expect(onSaved).toHaveBeenCalledWith({ id: "debt-1", name: "Emergency loan" });
  });
  it("accepts due days up to the 31st, stores the chosen day, and explains month-end fallback", async () => {
    mockCreateDebtAccount.mockResolvedValue({ debt: { id: "debt-1", name: "Car loan" } });
    const view = render(<NonCreditDebtForm userId="user-1" deviceId="device-1" onCancel={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.changeText(view.getByPlaceholderText("Enter debt name"), "Car loan"); fireEvent.changeText(view.getByPlaceholderText("Enter lender name"), "Bank A"); fireEvent.changeText(view.getByPlaceholderText("Enter original amount"), "1000"); fireEvent.changeText(view.getByPlaceholderText("Enter current balance"), "1000"); fireEvent.changeText(view.getByPlaceholderText("Enter payment amount"), "100");
    fireEvent.changeText(view.getByLabelText("Due day"), "31");
    expect(view.getByText(/Days 29, 30 and 31 become the 28th in February/)).toBeTruthy();
    pickDate(view, "Pay off by", new Date(2099, 6, 1));
    fireEvent.press(view.getByText("Save debt"));
    await waitFor(() => expect(mockCreateDebtAccount).toHaveBeenCalledWith("user-1", "device-1", expect.objectContaining({ paymentSchedule: expect.objectContaining({ dayOfMonth: 31 }) })));
  });
  it("keeps twice-a-month dates different in February", () => {
    const view = render(<NonCreditDebtForm userId="user-1" deviceId="device-1" onCancel={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.press(view.getByRole("radio", { name: "Select Twice a Month" }));
    fireEvent.changeText(view.getByLabelText("First payment day"), "28");
    fireEvent.changeText(view.getByLabelText("Second payment day"), "30");
    fireEvent.press(view.getByText("Save debt"));
    expect(view.getByText("Date 1 must be the 27th or earlier when Date 2 is after the 28th, so February still has two payments.")).toBeTruthy();
    expect(mockCreateDebtAccount).not.toHaveBeenCalled();
  });
  it("preserves auto-loan purchase data when saving an existing debt", async () => {
    const debt: DebtAccount = {
      id: "auto-1", name: "Car loan", lenderName: "Bank A", type: "auto_loan", status: "active", progress: "on_schedule",
      originalBalanceCentavos: 1_000_000, currentBalanceCentavos: 800_000, annualInterestRateBps: 0,
      minimumPaymentCentavos: 20_000, allowsExtraPayments: false, paymentFrequency: "monthly", paymentSchedule: {}, nextDueDate: "2026-10-01",
      maturityDate: null, targetPayoffDate: "2030-01-01", interestPeriod: "none", interestMethod: "no_interest", notes: null,
      typeSpecific: { startDate: "2026-01-01", feesCentavos: 0, penaltyInfo: null, termMonths: 48, autoLoan: { vehicleDescription: "Sedan", vehiclePurchasePriceCentavos: 1_200_000, downpaymentCentavos: 200_000, financedPrincipalCentavos: 1_000_000 } },
      hasPaymentHistory: false, archivedAt: null, paidOffAt: null, version: 1,
    };
    mockUpdateDebtAccount.mockResolvedValue({ debt });
    const view = render(<NonCreditDebtForm userId="user-1" deviceId="device-1" debt={debt} onCancel={jest.fn()} onSaved={jest.fn()} />);

    fireEvent.press(view.getByText("Save changes"));

    await waitFor(() => expect(mockUpdateDebtAccount).toHaveBeenCalledWith("user-1", "device-1", "auto-1", expect.objectContaining({
      typeSpecific: expect.objectContaining({ autoLoan: expect.objectContaining({ vehiclePurchasePriceCentavos: 1_200_000, downpaymentCentavos: 200_000, financedPrincipalCentavos: 1_000_000 }) }),
    })));
  });

  it("toggles whether this debt can receive extra payments", async () => {
    mockCreateDebtAccount.mockResolvedValue({ debt: { id: "debt-1", name: "Emergency loan" } });
    const view = render(<NonCreditDebtForm userId="user-1" deviceId="device-1" onCancel={jest.fn()} onSaved={jest.fn()} />);

    fireEvent.press(view.getByRole("switch", { name: "Allow extra payments" }));
    expect(view.getByRole("switch", { name: "Allow extra payments" }).props.accessibilityState).toMatchObject({ checked: true });
  });
});
