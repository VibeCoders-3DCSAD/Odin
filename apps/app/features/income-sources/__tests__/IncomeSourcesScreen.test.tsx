import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import IncomeSourcesScreen from "../IncomeSourcesScreen";
import { deleteIncomeSource, listIncomeSources } from "../../../local-db/repositories/financialFoundations";

jest.mock("../../../local-db/repositories/financialFoundations", () => ({
  listIncomeSources: jest.fn(),
  deleteIncomeSource: jest.fn(),
}));
jest.mock("../../../local-db/repositories/debtAccounts", () => ({ listDebtAccounts: async () => [] }));

const source = {
  id: "income-1", name: "Salary", frequency: "semi_monthly", expectedAmountCentavos: 2_000_000,
  paydayDayOfMonth: 15, paydaySecondDayOfMonth: 30, paydayDayOfWeek: null, isActive: true,
  recurringTemplateId: "recurring-1", destinationAccountId: "account-1", subcategoryId: "category-1",
  nextExpectedDate: null, notes: null,
} satisfies Awaited<ReturnType<typeof listIncomeSources>>[number];
const props = { userId: "user-1", deviceId: "device-1", onBack: jest.fn(), onAdd: jest.fn(), onEdit: jest.fn(), onSyncRequested: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listIncomeSources).mockResolvedValue([source]);
  jest.mocked(deleteIncomeSource).mockResolvedValue({ source: { ...source, isActive: false }, operation: {
    operation_id: "operation-1", user_id: "user-1", device_id: "device-1", entity: "income_sources",
    record_id: source.id, operation_type: "delete", base_version: 1, changed_fields: ["deleted"],
    payload: { deleted: true }, failure_message: "Could not delete", status: "pending", attempts: 0,
    last_error: null, discarded_at: null, created_at: "2026-10-23T00:00:00Z",
  } });
});

it("shows the source count, schedule and separate amount, and opens Add", async () => {
  const view = render(<IncomeSourcesScreen {...props} />);
  expect(await view.findByText("Twice a month · 15 and 30")).toBeTruthy();
  expect(view.getByText("PHP 20,000.00")).toBeTruthy();
  expect(view.getByText("1 income source")).toBeTruthy();
  expect(view.getByText("PHP 40,000.00")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Add income source"));
  expect(props.onAdd).toHaveBeenCalled();
});

it("shows loading feedback until the sources are loaded", async () => {
  const view = render(<IncomeSourcesScreen {...props} />);
  expect(view.getByText("Loading your income sources…")).toBeTruthy();
  expect(view.queryByText("No income sources yet")).toBeNull();
  await view.findByText("Salary");
  expect(view.queryByText("Loading your income sources…")).toBeNull();
});

it("offers an explicit Add button in the empty state", async () => {
  jest.mocked(listIncomeSources).mockResolvedValue([]);
  const view = render(<IncomeSourcesScreen {...props} />);
  await view.findByText("No income sources yet");
  fireEvent.press(view.getByText("Add an income source"));
  expect(props.onAdd).toHaveBeenCalled();
});

it("opens the named action sheet and edits the selected source", async () => {
  const view = render(<IncomeSourcesScreen {...props} />);
  fireEvent.press(await view.findByLabelText("Actions for Salary"));
  fireEvent.press(await view.findByText("Edit"));
  expect(props.onEdit).toHaveBeenCalledWith("income-1");
  expect(deleteIncomeSource).not.toHaveBeenCalled();
});

it("requires confirmation before deleting and refreshes the list", async () => {
  const view = render(<IncomeSourcesScreen {...props} />);
  fireEvent.press(await view.findByLabelText("Actions for Salary"));
  fireEvent.press(await view.findByText("Delete"));
  expect(await view.findByText("Delete Salary?")).toBeTruthy();
  expect(deleteIncomeSource).not.toHaveBeenCalled();
  jest.mocked(listIncomeSources).mockResolvedValue([]);
  fireEvent.press(view.getByLabelText("Confirm delete"));
  await view.findByText("No income sources yet");
  expect(deleteIncomeSource).toHaveBeenCalledWith("user-1", "device-1", "income-1");
  expect(props.onSyncRequested).toHaveBeenCalled();
});

it("shows a retry action when loading fails", async () => {
  jest.mocked(listIncomeSources).mockRejectedValueOnce(new Error("database unavailable"));
  const view = render(<IncomeSourcesScreen {...props} />);
  await view.findByText("Your income sources could not be loaded. Try again.");
  expect(view.queryByText("No income sources yet")).toBeNull();
  fireEvent.press(view.getByText("Retry"));
  await waitFor(() => expect(view.getByText("Salary")).toBeTruthy());
});

it("keeps the source when deletion is cancelled", async () => {
  const view = render(<IncomeSourcesScreen {...props} />);
  fireEvent.press(await view.findByLabelText("Actions for Salary"));
  fireEvent.press(await view.findByText("Delete"));
  fireEvent.press(view.getByText("Cancel"));
  expect(view.getByText("Salary")).toBeTruthy();
  expect(deleteIncomeSource).not.toHaveBeenCalled();
});

it("keeps the source and displays a safe error when deletion fails", async () => {
  jest.mocked(deleteIncomeSource).mockRejectedValueOnce(new Error("internal database error"));
  const view = render(<IncomeSourcesScreen {...props} />);
  fireEvent.press(await view.findByLabelText("Actions for Salary"));
  fireEvent.press(await view.findByText("Delete"));
  fireEvent.press(view.getByLabelText("Confirm delete"));
  await view.findByText("Your income source could not be deleted. Try again.");
  expect(view.getByText("Salary")).toBeTruthy();
  expect(props.onSyncRequested).not.toHaveBeenCalled();
});
