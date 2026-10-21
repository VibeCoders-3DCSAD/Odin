import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import SavingsGoalAccountSelector from "../SavingsGoalAccountSelector";

const mockList = jest.fn();
const mockGet = jest.fn();
jest.mock("../../../local-db/repositories/savingsGoalAccounts", () => ({
  listActiveSavingsGoalAccounts: (...args: unknown[]) => mockList(...args),
  getSavingsGoalAccount: (...args: unknown[]) => mockGet(...args),
}));

describe("SavingsGoalAccountSelector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue([{ id: "account-1", name: "Main account", status: "active" }]);
    mockGet.mockResolvedValue(null);
  });

  it("loads owned account choices on demand and requires an explicit selection", async () => {
    const onChange = jest.fn();
    const view = render(<SavingsGoalAccountSelector userId="user-1" value={null} onChange={onChange} />);
    expect(mockList).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText("Select financial account"));
    expect(view.getByLabelText("Loading financial accounts")).toBeTruthy();
    await waitFor(() => expect(view.getByLabelText("Link Main account")).toBeTruthy());
    expect(mockList).toHaveBeenCalledWith("user-1", "");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText("Link Main account"));
    expect(onChange).toHaveBeenCalledWith("account-1");
  });

  it("dismisses the action sheet without changing the account", async () => {
    const onChange = jest.fn();
    const view = render(<SavingsGoalAccountSelector userId="user-1" value={null} onChange={onChange} />);
    fireEvent.press(view.getByLabelText("Select financial account"));
    await waitFor(() => expect(view.getByLabelText("Link Main account")).toBeTruthy());
    expect(view.getByTestId("bottom-sheet-safe-area")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Close account picker"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("explains what to do when no active accounts are available", async () => {
    mockList.mockResolvedValueOnce([]);
    const view = render(<SavingsGoalAccountSelector userId="user-1" value={null} onChange={jest.fn()} />);
    fireEvent.press(view.getByLabelText("Select financial account"));
    await waitFor(() => expect(view.getByText("Create or activate a financial account in Accounts before creating a savings goal.")).toBeTruthy());
  });

  it("retries a failed account lookup", async () => {
    mockList.mockRejectedValueOnce(new Error("unavailable"));
    const view = render(<SavingsGoalAccountSelector userId="user-1" value={null} onChange={jest.fn()} />);
    fireEvent.press(view.getByLabelText("Select financial account"));
    await waitFor(() => expect(view.getByText("Financial accounts could not be loaded.")).toBeTruthy());
    fireEvent.press(view.getByText("Retry accounts"));
    await waitFor(() => expect(view.getByLabelText("Link Main account")).toBeTruthy());
  });

  it("searches within active accounts", async () => {
    const view = render(<SavingsGoalAccountSelector userId="user-1" value={null} onChange={jest.fn()} />);
    fireEvent.press(view.getByLabelText("Select financial account"));
    await waitFor(() => expect(view.getByLabelText("Link Main account")).toBeTruthy());
    fireEvent.changeText(view.getByLabelText("Search financial accounts"), "Main");
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith("user-1", "Main"));
    await waitFor(() => expect(view.getByLabelText("Link Main account")).toBeTruthy());
  });

  it("preserves an existing archived link without offering it as a new choice", async () => {
    mockGet.mockResolvedValueOnce({ id: "old-account", name: "Old account", status: "archived" });
    const view = render(<SavingsGoalAccountSelector userId="user-1" value="old-account" onChange={jest.fn()} />);
    await waitFor(() => expect(view.getByText("Old account (archived)")).toBeTruthy());
    expect(mockGet).toHaveBeenCalledWith("user-1", "old-account");
    fireEvent.press(view.getByLabelText("Select financial account"));
    await waitFor(() => expect(view.getByLabelText("Link Main account")).toBeTruthy());
    expect(view.queryByLabelText("Link Old account")).toBeNull();
  });
});
