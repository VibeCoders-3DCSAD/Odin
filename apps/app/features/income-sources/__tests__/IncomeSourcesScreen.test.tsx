import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import IncomeSourcesScreen from "../IncomeSourcesScreen";

jest.mock("../../../local-db/repositories/financialFoundations", () => ({
  listIncomeSources: async () => [{ id: "income-1", name: "Salary", frequency: "semi_monthly", expectedAmountCentavos: 2_000_000, isActive: true }],
  deleteIncomeSource: jest.fn(),
}));
jest.mock("../../../local-db/repositories/debtAccounts", () => ({ listDebtAccounts: async () => [] }));

describe("IncomeSourcesScreen", () => {
  it("opens the income source form page to add a source", async () => {
    const onAdd = jest.fn();
    const view = render(<IncomeSourcesScreen userId="user-1" deviceId="device-1" onBack={jest.fn()} onAdd={onAdd} onEdit={jest.fn()} />);
    expect(await view.findByText("Twice a month · ₱20,000.00")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Add income source"));
    expect(onAdd).toHaveBeenCalled();
  });
});
