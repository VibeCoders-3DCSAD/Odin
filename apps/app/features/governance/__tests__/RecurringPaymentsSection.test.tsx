import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { RecurringPaymentsSection } from "../components/RecurringPaymentsSection";

const mockListPersistedUnusualSpendings = jest.fn();
const mockChangeRecurrenceMonths = jest.fn();
const mockStopRecurrence = jest.fn();
jest.mock("../../../local-db/repositories/unusualSpending", () => ({
  listPersistedUnusualSpendings: (...args: unknown[]) => mockListPersistedUnusualSpendings(...args),
  changeRecurrenceMonths: (...args: unknown[]) => mockChangeRecurrenceMonths(...args),
  stopRecurrence: (...args: unknown[]) => mockStopRecurrence(...args),
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
  mockChangeRecurrenceMonths.mockReset().mockResolvedValue(undefined);
  mockStopRecurrence.mockReset().mockResolvedValue(undefined);
});

it("lists only payments in certain months, with their months", async () => {
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  expect(await view.findByText("Paid Jun 10, 2026 · June and November")).toBeTruthy();
  expect(view.getByText("Paid Jun 10, 2026 · June")).toBeTruthy();
  expect(view.queryByText(/Gadgets/)).toBeNull();
  expect(mockListPersistedUnusualSpendings).toHaveBeenCalledWith("user-1");
});

it("saves edited months", async () => {
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  fireEvent.press(await view.findByLabelText("Edit months for Tuition, PHP 50,000.00"));
  fireEvent.press(view.getByLabelText("November"));
  fireEvent.press(view.getByLabelText("August"));
  fireEvent.press(view.getByLabelText("Save months for Tuition, PHP 50,000.00"));

  await waitFor(() => expect(mockChangeRecurrenceMonths).toHaveBeenCalledWith("user-1", "device-1", "tuition", [6, 8]));
  expect(mockListPersistedUnusualSpendings).toHaveBeenCalledTimes(2);
});

it("needs at least one month to save", async () => {
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  fireEvent.press(await view.findByLabelText("Edit months for School fees, PHP 50,000.00"));
  fireEvent.press(view.getByLabelText("June"));
  fireEvent.press(view.getByLabelText("Save months for School fees, PHP 50,000.00"));

  expect(view.getByText("Choose at least one month")).toBeTruthy();
  expect(mockChangeRecurrenceMonths).not.toHaveBeenCalled();
});

it("removes a payment only after confirmation", async () => {
  const alert = jest.spyOn(Alert, "alert");
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  fireEvent.press(await view.findByLabelText("Edit months for Tuition, PHP 50,000.00"));
  fireEvent.press(view.getByLabelText("Remove Tuition, PHP 50,000.00"));
  expect(mockStopRecurrence).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0]![2]!;
  buttons.find((button) => button.text === "Remove")!.onPress!();

  await waitFor(() => expect(mockStopRecurrence).toHaveBeenCalledWith("user-1", "device-1", "tuition"));
});

it("shows an error when a change cannot be saved", async () => {
  mockChangeRecurrenceMonths.mockRejectedValue(new Error("locked"));
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  fireEvent.press(await view.findByLabelText("Edit months for Tuition, PHP 50,000.00"));
  fireEvent.press(view.getByLabelText("Save months for Tuition, PHP 50,000.00"));

  expect(await view.findByText("Your change could not be saved. Try again.")).toBeTruthy();
});

it("explains how to add one when there are none", async () => {
  mockListPersistedUnusualSpendings.mockResolvedValue([]);
  const view = render(<RecurringPaymentsSection userId="user-1" deviceId="device-1" />);

  expect(await view.findByText(/None yet/)).toBeTruthy();
});
