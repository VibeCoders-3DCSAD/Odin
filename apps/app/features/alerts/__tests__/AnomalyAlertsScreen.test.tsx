import { fireEvent, render, waitFor } from "@testing-library/react-native";
import AnomalyAlertsScreen from "../AnomalyAlertsScreen";

const mockListPersistedUnusualSpendings = jest.fn();
const mockAnswerUnusualSpending = jest.fn();

jest.mock("../../../local-db/repositories/alerts/unusualSpending", () => ({
  answerUnusualSpending: (...args: unknown[]) => mockAnswerUnusualSpending(...args),
  listPersistedUnusualSpendings: (...args: unknown[]) => mockListPersistedUnusualSpendings(...args),
}));

const alert = (index: number) => ({
  transactionId: `transaction-${index}`, transactionDate: "2026-10-20", amountCentavos: 100_000,
  subcategoryId: "groceries", subcategoryLabel: `Groceries ${index}`, accountName: "Cash",
  usableHistoryCount: 6, usualSpendingCentavos: 12_500, lowerBoundCentavos: 7_500, upperBoundCentavos: 20_000,
  severity: 1.2, confirmedRecurring: false, recurrence: null, recurrenceMonths: null,
});

describe("AnomalyAlertsScreen", () => {
  beforeEach(() => {
    mockListPersistedUnusualSpendings.mockReset();
    mockAnswerUnusualSpending.mockReset().mockResolvedValue(undefined);
  });

  it("excludes yearly answers while keeping other spending alerts", async () => {
    mockListPersistedUnusualSpendings.mockResolvedValue([
      alert(0),
      { ...alert(1), recurrence: "yearly", recurrenceMonths: [6, 11] },
      { ...alert(2), recurrence: "yearly" },
      { ...alert(3), recurrence: "frequent", confirmedRecurring: true },
      { ...alert(4), recurrence: "one_time" },
    ]);
    const view = render(<AnomalyAlertsScreen userId="user-1" deviceId="device-1" />);
    await waitFor(() => expect(view.getAllByLabelText(/^Open spending alert for /)).toHaveLength(3));
    expect(view.queryByLabelText("Open spending alert for Groceries 1")).toBeNull();
    expect(view.queryByLabelText("Open spending alert for Groceries 2")).toBeNull();
  });

  it("does not reopen a yearly payment from a transaction link", async () => {
    mockListPersistedUnusualSpendings.mockResolvedValue([{ ...alert(1), recurrence: "yearly", recurrenceMonths: [12] }]);
    const view = render(<AnomalyAlertsScreen userId="user-1" deviceId="device-1" initialTransactionId="transaction-1" />);
    expect(await view.findByText("No unusual spending found")).toBeTruthy();
    expect(view.queryByText("Unusual Groceries 1 spending")).toBeNull();
  });

  it("removes an alert immediately after saving its yearly months", async () => {
    mockListPersistedUnusualSpendings.mockResolvedValueOnce([alert(1)])
      .mockResolvedValue([{ ...alert(1), recurrence: "yearly", recurrenceMonths: [10, 12] }]);
    const view = render(<AnomalyAlertsScreen userId="user-1" deviceId="device-1" />);
    fireEvent.press(await view.findByLabelText("Open spending alert for Groceries 1"));
    fireEvent.press(view.getByLabelText("Yes, in certain months"));
    fireEvent.press(view.getByLabelText("December"));
    fireEvent.press(view.getByLabelText("Save months"));
    expect(await view.findByText("No unusual spending found")).toBeTruthy();
    expect(mockAnswerUnusualSpending).toHaveBeenCalledWith("user-1", "device-1", "transaction-1", "yearly", [10, 12]);
    expect(view.queryByLabelText("Back to alerts")).toBeNull();
  });

  it("shows five alerts at a time until every alert is shown", async () => {
    mockListPersistedUnusualSpendings.mockResolvedValue(Array.from({ length: 12 }, (_, index) => alert(index)));
    const view = render(<AnomalyAlertsScreen userId="user-1" deviceId="device-1" />);

    await waitFor(() => expect(view.getAllByLabelText(/^Open spending alert for /)).toHaveLength(5));
    fireEvent.press(view.getByLabelText("Show 5 more spending alerts"));
    expect(view.getAllByLabelText(/^Open spending alert for /)).toHaveLength(10);
    fireEvent.press(view.getByLabelText("Show 2 more spending alerts"));
    expect(view.getAllByLabelText(/^Open spending alert for /)).toHaveLength(12);
    expect(view.queryByText(/^Show \d+ more$/)).toBeNull();
  });
});
