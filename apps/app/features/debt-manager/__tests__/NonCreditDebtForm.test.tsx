import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import NonCreditDebtForm from "../NonCreditDebtForm";

const mockCreateDebtAccount = jest.fn();
const mockUpdateDebtAccount = jest.fn();
jest.mock("../../../local-db/repositories/debtAccounts", () => ({
  createDebtAccount: (...args: unknown[]) => mockCreateDebtAccount(...args),
  updateDebtAccount: (...args: unknown[]) => mockUpdateDebtAccount(...args),
}));

describe("NonCreditDebtForm", () => {
  beforeEach(() => { mockCreateDebtAccount.mockReset(); mockUpdateDebtAccount.mockReset(); });
  it("validates required fields before creating a debt", () => {
    const view = render(<NonCreditDebtForm userId="user-1" deviceId="device-1" onCancel={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.press(view.getByText("Save debt"));
    expect(view.getByText("Some debt details are not valid. Check the highlighted fields and try again.")).toBeTruthy();
    expect(mockCreateDebtAccount).not.toHaveBeenCalled();
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
    fireEvent.changeText(view.getByPlaceholderText("Enter debt name"), "Emergency loan"); fireEvent.changeText(view.getByPlaceholderText("Enter lender name"), "Bank A"); fireEvent.changeText(view.getByPlaceholderText("Enter original amount"), "1000"); fireEvent.changeText(view.getByPlaceholderText("Enter current balance"), "1000"); fireEvent.changeText(view.getByPlaceholderText("Enter payment amount"), "100"); fireEvent.changeText(view.getByPlaceholderText("Select start date"), "2026-09-01"); fireEvent.changeText(view.getByPlaceholderText("Select payment date"), "2026-10-01"); fireEvent.changeText(view.getByPlaceholderText("Select target payoff date"), "2027-07-01"); fireEvent.press(view.getByText("Save debt"));
    await waitFor(() => expect(mockCreateDebtAccount).toHaveBeenCalledWith("user-1", "device-1", expect.objectContaining({ name: "Emergency loan", originalBalanceCentavos: 100000, currentBalanceCentavos: 100000, minimumPaymentCentavos: 10000, targetPayoffDate: "2027-07-01" })));
    expect(onSaved).toHaveBeenCalledWith({ id: "debt-1", name: "Emergency loan" });
  });
});
