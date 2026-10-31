import React from "react";
import { render } from "@testing-library/react-native";
import UpcomingPaymentsCard from "../UpcomingPaymentsCard";

it("shows remaining amounts, a monthly total, and overdue labels", () => {
  const view = render(<UpcomingPaymentsCard today="2026-10-21" payments={[
    { id: "loan", accountId: "loan", name: "Loan", kind: "non_credit_card", dueDate: "2026-10-15", remainingCentavos: 12_345 },
    { id: "card", accountId: "card", name: "Visa", kind: "credit_card_statement", dueDate: "2026-10-25", remainingCentavos: 50_000 },
  ]} />);
  expect(view.getByText("Upcoming Payments")).toBeTruthy();
  expect(view.getByText("₱623.45 remaining this month")).toBeTruthy();
  expect(view.getByText("Scheduled payment · Overdue Oct 15")).toBeTruthy();
  expect(view.getByText("Statement · Due Oct 25")).toBeTruthy();
});

it("shows an explicit empty state when this month's payments are paid", () => {
  const view = render(<UpcomingPaymentsCard today="2026-10-21" payments={[]} />);
  expect(view.getByText("No unpaid debt payments due this month.")).toBeTruthy();
  expect(view.getByText("₱0.00 remaining this month")).toBeTruthy();
});
