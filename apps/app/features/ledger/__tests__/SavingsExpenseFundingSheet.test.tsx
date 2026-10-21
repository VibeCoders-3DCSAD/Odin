import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import SavingsExpenseFundingSheet from "../components/SavingsExpenseFundingSheet";
jest.mock("../../../local-db/client", () => ({ initDatabase: jest.fn() }));
const funding = { accountId: "account", unallocatedCentavos: 500_000, requiredWithdrawalCentavos: 200_000, existingShortfallCentavos: 0, goals: [
  { id: "emergency", name: "Emergency", availableCentavos: 1_000_000 }, { id: "travel", name: "Travel", availableCentavos: 500_000 },
] };
const confirmLabel = "Confirm affected goals and save";

describe("expense goal funding confirmation", () => {
  it("lets users choose an affected goal without entering an amount and requires confirmation", () => {
    const onConfirm = jest.fn();
    const view = render(<SavingsExpenseFundingSheet funding={funding} onCancel={jest.fn()} onConfirm={onConfirm} />);
    expect(view.queryAllByRole("textbox")).toHaveLength(0);
    fireEvent.press(view.getByText(confirmLabel));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole("checkbox", { name: "Affect Emergency" }));
    expect(view.getByText("₱2,000.00 used · ₱8,000.00 remaining")).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.press(view.getByText(confirmLabel));
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ savings_goal_id: "emergency", amount_centavos: 200_000 }),
    ]);
  });

  it("automatically covers the expense in selection order without exceeding goal balances", () => {
    const onConfirm = jest.fn();
    const view = render(<SavingsExpenseFundingSheet funding={{ ...funding, requiredWithdrawalCentavos: 1_100_000 }} onCancel={jest.fn()} onConfirm={onConfirm} />);
    fireEvent.press(view.getByLabelText("Affect Travel"));
    expect(view.getByText("Select goals to cover ₱6,000.00 more.")).toBeTruthy();
    fireEvent.press(view.getByText(confirmLabel));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText("Affect Emergency"));
    expect(view.getByText("₱5,000.00 used · ₱0.00 remaining")).toBeTruthy();
    expect(view.getByText("₱6,000.00 used · ₱4,000.00 remaining")).toBeTruthy();
    fireEvent.press(view.getByText(confirmLabel));
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ savings_goal_id: "travel", amount_centavos: 500_000 }),
      expect.objectContaining({ savings_goal_id: "emergency", amount_centavos: 600_000 }),
    ]);
  });

  it("recalculates the impact when a goal is deselected", () => {
    const onConfirm = jest.fn();
    const view = render(<SavingsExpenseFundingSheet funding={funding} onCancel={jest.fn()} onConfirm={onConfirm} />);
    fireEvent.press(view.getByLabelText("Affect Emergency"));
    fireEvent.press(view.getByLabelText("Affect Travel"));
    fireEvent.press(view.getByLabelText("Affect Emergency"));
    expect(view.getByRole("checkbox", { name: "Affect Emergency" }).props.accessibilityState.checked).toBe(false);
    expect(view.getByText("₱2,000.00 used · ₱3,000.00 remaining")).toBeTruthy();
    fireEvent.press(view.getByText(confirmLabel));
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ savings_goal_id: "travel", amount_centavos: 200_000 }),
    ]);
  });

  it("excludes unused selected goals from the saved impact", () => {
    const onConfirm = jest.fn();
    const view = render(<SavingsExpenseFundingSheet funding={funding} onCancel={jest.fn()} onConfirm={onConfirm} />);
    fireEvent.press(view.getByLabelText("Affect Emergency"));
    fireEvent.press(view.getByLabelText("Affect Travel"));
    fireEvent.press(view.getByText(confirmLabel));
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ savings_goal_id: "emergency", amount_centavos: 200_000 }),
    ]);
  });

  it("hides empty goals and allows cancellation without saving", () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const view = render(<SavingsExpenseFundingSheet funding={{ ...funding, goals: [...funding.goals, { id: "empty", name: "Empty", availableCentavos: 0 }] }} onCancel={onCancel} onConfirm={onConfirm} />);
    expect(view.queryByLabelText("Affect Empty")).toBeNull();
    fireEvent.press(view.getByLabelText("Affect Emergency"));
    fireEvent.press(view.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
