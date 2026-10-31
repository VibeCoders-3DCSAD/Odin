import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import DebtPaymentTrend from "../DebtPaymentTrend";

it("shows five recent payments and reveals five more when requested", () => {
  const view = render(<DebtPaymentTrend points={[
    { date: "2026-09-01", debtName: "Debt 1", amountCentavos: 100 },
    { date: "2026-09-02", debtName: "Debt 2", amountCentavos: 200 },
    { date: "2026-09-03", debtName: "Debt 3", amountCentavos: 300 },
    { date: "2026-09-04", debtName: "Debt 4", amountCentavos: 400 },
    { date: "2026-09-05", debtName: "Debt 5", amountCentavos: 500 },
    { date: "2026-09-06", debtName: "A debt name that is intentionally too long for a narrow row", amountCentavos: 600 },
  ]} />);

  expect(view.getByText("Debt 2")).toBeTruthy();
  expect(view.queryByText("Debt 1")).toBeNull();
  expect(view.getByRole("button", { name: "Show 5 more payments" })).toBeTruthy();

  fireEvent.press(view.getByRole("button", { name: "Show 5 more payments" }));

  expect(view.getByText("Debt 1")).toBeTruthy();
  expect(view.queryByRole("button", { name: "Show 5 more payments" })).toBeNull();
  expect(view.getByLabelText("2026-09-06, A debt name that is intentionally too long for a narrow row, payment made PHP 6.00")).toBeTruthy();
});
