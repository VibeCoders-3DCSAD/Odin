import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import SavingsExpenseFundingSheet from "../components/SavingsExpenseFundingSheet";
jest.mock("../../../local-db/client", () => ({ initDatabase: jest.fn() }));
const funding = { accountId: "account", unallocatedCentavos: 500_000, requiredWithdrawalCentavos: 200_000, existingShortfallCentavos: 0, goals: [
  { id: "emergency", name: "Emergency", availableCentavos: 1_000_000 }, { id: "travel", name: "Travel", availableCentavos: 500_000 },
] };
describe("expense goal funding confirmation", () => {
  it("requires an exact split and explicit confirmation before withdrawing", () => {
    const onConfirm = jest.fn();
    const view = render(<SavingsExpenseFundingSheet funding={funding} onCancel={jest.fn()} onConfirm={onConfirm} />);
    fireEvent.press(view.getByText("Confirm withdrawals and save"));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.changeText(view.getByLabelText("Withdraw from Emergency"), "1200");
    fireEvent.changeText(view.getByLabelText("Withdraw from Travel"), "800");
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.press(view.getByText("Confirm withdrawals and save"));
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ savings_goal_id: "emergency", amount_centavos: 120_000 }),
      expect.objectContaining({ savings_goal_id: "travel", amount_centavos: 80_000 }),
    ]);
  });
  it("rejects amounts beyond a goal's balance and allows cancelling", () => {
    const onConfirm = jest.fn(); const onCancel = jest.fn();
    const view = render(<SavingsExpenseFundingSheet funding={{ ...funding, requiredWithdrawalCentavos: 1_100_000 }} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.changeText(view.getByLabelText("Withdraw from Emergency"), "11000");
    fireEvent.press(view.getByText("Confirm withdrawals and save"));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.press(view.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
