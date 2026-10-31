import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { RecurringPaymentsSection } from "../components/RecurringPaymentsSection";

const mockListPersistedUnusualSpendings = jest.fn();
const mockReviseRecurringPaymentGroup = jest.fn();
jest.mock("../../../local-db/repositories/alerts/unusualSpending", () => ({
  listPersistedUnusualSpendings: (...args: unknown[]) => mockListPersistedUnusualSpendings(...args),
  reviseRecurringPaymentGroup: (...args: unknown[]) => mockReviseRecurringPaymentGroup(...args),
}));

const insight = (transactionId: string, recurrence: string | null, recurrenceMonths: number[] | null, subcategoryLabel = "Tuition") => ({
  transactionId, transactionDate: "2026-06-10", amountCentavos: 5_000_000, subcategoryId: "school", subcategoryLabel, accountName: "Cash",
  usableHistoryCount: 6, usualSpendingCentavos: 100_000, lowerBoundCentavos: 50_000, upperBoundCentavos: 200_000,
  severity: 3, confirmedRecurring: false, recurrence, recurrenceMonths,
});

beforeEach(() => {
  jest.restoreAllMocks();
  mockListPersistedUnusualSpendings.mockReset().mockResolvedValue([
    insight("tuition", "yearly", [6, 11]),
    insight("laptop", "one_time", null, "Gadgets"),
    insight("fees", "yearly", null, "School fees"),
  ]);
  mockReviseRecurringPaymentGroup.mockReset().mockResolvedValue(undefined);
});

it("lists only payments in certain months, with their months", async () => {
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  expect(await view.findByText("Paid Jun 10, 2026 · Yearly, every June and November")).toBeTruthy();
  expect(view.getByText("Paid Jun 10, 2026 · Yearly, every June")).toBeTruthy();
  expect(view.queryByText(/Gadgets/)).toBeNull();
  expect(mockListPersistedUnusualSpendings).toHaveBeenCalledWith("user-1");
});

it("consolidates matching answers across dates and saves months for the whole group", async () => {
  mockListPersistedUnusualSpendings.mockResolvedValue([
    { ...insight("may", "yearly", [6, 11]), transactionDate: "2026-05-20" },
    { ...insight("june", "yearly", [11, 6]), transactionDate: "2026-06-20" },
    insight("other-months", "yearly", [1]),
    { ...insight("other-amount", "yearly", [6, 11]), amountCentavos: 100_000 },
    { ...insight("other-category", "yearly", [6, 11], "Books"), subcategoryId: "books" },
  ]);
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  expect(await view.findByText("2 payments · Last paid Jun 20, 2026 · Yearly, every June and November")).toBeTruthy();
  expect(view.getAllByRole("button")).toHaveLength(4);
  fireEvent.press(view.getAllByLabelText("Edit months for Tuition, ₱50,000.00")[0]);
  expect(view.getByText("Changes apply to all 2 payments in this group.")).toBeTruthy();
  fireEvent.press(view.getByLabelText("November"));
  fireEvent.press(view.getByLabelText("Save months for Tuition, ₱50,000.00"));
  await waitFor(() => expect(mockReviseRecurringPaymentGroup).toHaveBeenCalledWith("user-1", "device-1", ["june", "may"], [6]));
});

it("confirms removing every payment in a consolidated group", async () => {
  mockListPersistedUnusualSpendings.mockResolvedValue([
    insight("first", "yearly", [6]), insight("second", "yearly", null),
  ]);
  const alert = jest.spyOn(Alert, "alert");
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);
  fireEvent.press(await view.findByLabelText("Edit months for Tuition, ₱50,000.00"));
  fireEvent.press(view.getByLabelText("Remove Tuition, ₱50,000.00"));
  expect(alert.mock.calls[0]![1]).toContain("All 2 payments");
  expect(mockReviseRecurringPaymentGroup).not.toHaveBeenCalled();
  await act(async () => { alert.mock.calls[0]![2]!.find((button) => button.text === "Remove")!.onPress!(); });
  expect(mockReviseRecurringPaymentGroup).toHaveBeenCalledWith("user-1", "device-1", ["first", "second"], null);
});

it("saves edited months", async () => {
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  fireEvent.press(await view.findByLabelText("Edit months for Tuition, ₱50,000.00"));
  fireEvent.press(view.getByLabelText("November"));
  fireEvent.press(view.getByLabelText("August"));
  fireEvent.press(view.getByLabelText("Save months for Tuition, ₱50,000.00"));

  await waitFor(() => expect(mockReviseRecurringPaymentGroup).toHaveBeenCalledWith("user-1", "device-1", ["tuition"], [6, 8]));
  expect(mockListPersistedUnusualSpendings).toHaveBeenCalledTimes(2);
});

it("needs at least one month to save", async () => {
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  fireEvent.press(await view.findByLabelText("Edit months for School fees, ₱50,000.00"));
  fireEvent.press(view.getByLabelText("June"));
  fireEvent.press(view.getByLabelText("Save months for School fees, ₱50,000.00"));

  expect(view.getByText("Choose at least one month")).toBeTruthy();
  expect(mockReviseRecurringPaymentGroup).not.toHaveBeenCalled();
});

it("removes a payment only after confirmation", async () => {
  const alert = jest.spyOn(Alert, "alert");
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  fireEvent.press(await view.findByLabelText("Edit months for Tuition, ₱50,000.00"));
  fireEvent.press(view.getByLabelText("Remove Tuition, ₱50,000.00"));
  expect(mockReviseRecurringPaymentGroup).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0]![2]!;
  buttons.find((button) => button.text === "Remove")!.onPress!();

  await waitFor(() => expect(mockReviseRecurringPaymentGroup).toHaveBeenCalledWith("user-1", "device-1", ["tuition"], null));
});

it("shows an error when a change cannot be saved", async () => {
  mockReviseRecurringPaymentGroup.mockRejectedValue(new Error("locked"));
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  fireEvent.press(await view.findByLabelText("Edit months for Tuition, ₱50,000.00"));
  fireEvent.press(view.getByLabelText("Save months for Tuition, ₱50,000.00"));

  expect(await view.findByText("Your change could not be saved. Try again.")).toBeTruthy();
});

it("explains how to add one when there are none", async () => {
  mockListPersistedUnusualSpendings.mockResolvedValue([]);
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  expect(await view.findByText(/None yet/)).toBeTruthy();
});
