import { fireEvent, render, waitFor } from "@testing-library/react-native";
import AnomalyAlertsScreen from "../AnomalyAlertsScreen";

const mockListPersistedUnusualSpendings = jest.fn();

jest.mock("../../../local-db/repositories/unusualSpending", () => ({
  answerUnusualSpending: jest.fn(),
  listPersistedUnusualSpendings: (...args: unknown[]) => mockListPersistedUnusualSpendings(...args),
}));

const alert = (index: number) => ({
  transactionId: `transaction-${index}`, transactionDate: "2026-10-20", amountCentavos: 100_000,
  subcategoryId: "groceries", subcategoryLabel: `Groceries ${index}`, accountName: "Cash",
  usableHistoryCount: 6, usualSpendingCentavos: 12_500, lowerBoundCentavos: 7_500, upperBoundCentavos: 20_000,
  severity: 1.2, confirmedRecurring: false, recurrence: null,
});

describe("AnomalyAlertsScreen", () => {
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
