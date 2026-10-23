import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ReminderSection } from "../AttentionUpcoming";
import type { DashboardReminder } from "../../types";

jest.mock("../../hooks/useDashboardReminders", () => ({ useDashboardReminders: jest.fn() }));
const item: DashboardReminder = { id: "income", title: "Salary", detail: "Expected income · Payroll", amountCentavos: 50000, date: "2026-10-29", target: { kind: "income", id: "source" } };

it("shows amounts and calendar days and opens the selected record", () => {
  const onOpen = jest.fn();
  const view = render(<ReminderSection title="Upcoming" section={{ items: [item], unavailable: false }} loading={false} empty="No reminders" onRetry={jest.fn()} onOpen={onOpen} upcoming today="2026-10-22" />);
  expect(view.getByText("Expected income · Payroll")).toBeTruthy();
  expect(view.getByText("₱500.00")).toBeTruthy();
  expect(view.getByText("Oct 29 · In 7 days")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Review Salary"));
  expect(onOpen).toHaveBeenCalledWith({ kind: "income", id: "source" });
});

it("distinguishes loading, empty and unavailable information with retry", () => {
  const onRetry = jest.fn();
  const props = { title: "Needs Attention", empty: "Nothing needs attention", onRetry, onOpen: jest.fn() };
  const view = render(<ReminderSection {...props} loading />);
  expect(view.getByLabelText("Loading Needs Attention")).toBeTruthy();
  expect(view.queryByText(props.empty)).toBeNull();
  view.rerender(<ReminderSection {...props} loading={false} section={{ items: [], unavailable: false }} />);
  expect(view.getByText(props.empty)).toBeTruthy();
  view.rerender(<ReminderSection {...props} loading={false} section={{ items: [], unavailable: true }} />);
  expect(view.queryByText(props.empty)).toBeNull();
  expect(view.getByText("Some needs attention information is unavailable.")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Retry Needs Attention"));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

it("keeps available observations and their frequent expense prompt visible during partial failure", () => {
  const view = render(<ReminderSection title="Needs Attention" section={{ unavailable: true, items: [{ ...item, title: "Unusual groceries spending", detail: "Will this be a frequent expense?", target: { kind: "observation", id: "expense" } }] }} loading={false} empty="No issues" onRetry={jest.fn()} onOpen={jest.fn()} />);
  expect(view.getByText("Will this be a frequent expense?")).toBeTruthy();
  expect(view.getByText("Review spending →")).toBeTruthy();
  expect(view.queryByText("No issues")).toBeNull();
});
