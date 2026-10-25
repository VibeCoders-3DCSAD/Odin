import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import SpendingForecastScreen from "../SpendingForecastScreen";
import { categorySeries, forecastInterpretation, forecastReliabilityNote } from "../QuarterlyForecastCharts";
import type { QuarterlyForecastPayload } from "../types";

const mockGetSnapshot = jest.fn();
const mockUpsertSnapshot = jest.fn();
const mockListForecastTransactions = jest.fn();
const mockRequestQuarterlyForecast = jest.fn();
const mockRequestForecastInterpretation = jest.fn();
const mockListScheduledPayments = jest.fn();
const mockListQuarterlySpending = jest.fn();
const mockPastQuarters = jest.fn();
const mockListMonthlySpending = jest.fn();
const mockRecentMonths = jest.fn();
let mockOnline = true;

jest.mock("../../../local-db/repositories/dashboardSnapshots", () => ({
  getSnapshot: (...args: unknown[]) => mockGetSnapshot(...args),
  upsertSnapshot: (...args: unknown[]) => mockUpsertSnapshot(...args),
}));
jest.mock("../../../local-db/repositories/forecastSnapshots", () => ({ saveForecastSnapshot: async () => undefined }));
jest.mock("../../../local-db/repositories/forecastTransactions", () => ({
  getForecastHistoryStartDate: () => "2025-10-01",
  listForecastTransactions: (...args: unknown[]) => mockListForecastTransactions(...args),
  listQuarterlySpending: (...args: unknown[]) => mockListQuarterlySpending(...args),
  pastQuarters: (...args: unknown[]) => mockPastQuarters(...args),
  listMonthlySpending: (...args: unknown[]) => mockListMonthlySpending(...args),
  recentMonths: (...args: unknown[]) => mockRecentMonths(...args),
}));
jest.mock("../../../local-db/repositories/scheduledPayments", () => ({
  listScheduledPayments: (...args: unknown[]) => mockListScheduledPayments(...args),
}));
jest.mock("../../../services/connectivity", () => ({
  useConnectivityStore: (select: (state: { online: boolean }) => unknown) => select({ online: mockOnline }),
}));
jest.mock("../api", () => ({
  requestQuarterlyForecast: (...args: unknown[]) => mockRequestQuarterlyForecast(...args),
  requestForecastInterpretation: (...args: unknown[]) => mockRequestForecastInterpretation(...args),
}));

const forecast: QuarterlyForecastPayload = {
  quarters: [
    { quarter: "2026Q4", totalCentavos: 1_500_000, categories: [{ category: "food", amountCentavos: 1_000_000 }, { category: "transport", amountCentavos: 500_000 }] },
    { quarter: "2027Q1", totalCentavos: 1_650_000, categories: [{ category: "food", amountCentavos: 1_100_000 }, { category: "transport", amountCentavos: 550_000 }] },
  ],
  modelVersion: "hfce-sarima-v4-category-quarterly",
  generatedAt: "2026-10-18T00:00:00.000Z",
};

const snapshot = { id: "s-1", user_id: "user-1", source: "forecast_quarterly", payload_json: JSON.stringify(forecast), updated_at: "2026-10-18T00:00:00.000Z", stale: false };

describe("SpendingForecastScreen", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockOnline = true;
    mockUpsertSnapshot.mockReset().mockResolvedValue(undefined);
    mockGetSnapshot.mockResolvedValue(snapshot);
    mockListForecastTransactions.mockResolvedValue([{ transactionId: "t-1", date: "2026-09-04", amount: 100, category: "food", transactionType: "expense" }]);
    mockRequestQuarterlyForecast.mockResolvedValue({ response: { ok: true }, body: { payload: forecast } });
    mockRequestForecastInterpretation.mockRejectedValue(new Error("offline"));
    mockListScheduledPayments.mockResolvedValue([]);
    mockListQuarterlySpending.mockResolvedValue([]);
    mockPastQuarters.mockReturnValue(["2025Q2", "2025Q3", "2025Q4", "2026Q1", "2026Q2", "2026Q3"]);
    mockListMonthlySpending.mockResolvedValue([]);
    mockRecentMonths.mockReturnValue(["2026-08", "2026-09", "2026-10"]);
  });

  it("shows stale cached charts while history and revalidation are pending", async () => {
    mockGetSnapshot.mockResolvedValue({ ...snapshot, stale: true });
    mockListQuarterlySpending.mockReturnValue(new Promise(() => {}));
    mockRequestQuarterlyForecast.mockReturnValue(new Promise(() => {}));
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(view.getByText("PHP 15,000")).toBeTruthy());
    expect(view.getByText("Updating forecast…")).toBeTruthy();
    expect(mockRequestQuarterlyForecast).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it("keeps loading on a cache miss until the first forecast arrives", async () => {
    mockGetSnapshot.mockResolvedValue(null);
    let resolveForecast!: (value: { response: { ok: boolean }; body: { payload: QuarterlyForecastPayload } }) => void;
    mockRequestQuarterlyForecast.mockImplementationOnce(() => new Promise((resolve) => { resolveForecast = resolve; }));
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(mockRequestQuarterlyForecast).toHaveBeenCalledTimes(1));
    expect(view.getByLabelText("Loading spending forecast")).toBeTruthy();
    expect(view.queryByText("Record posted transactions to unlock a spending forecast.")).toBeNull();
    await act(async () => { resolveForecast({ response: { ok: true }, body: { payload: forecast } }); });
    expect(view.getByText("PHP 15,000")).toBeTruthy();
    expect(view.queryByLabelText("Loading spending forecast")).toBeNull();
  });

  it("retains the selected cached quarter when background revalidation replaces its amounts", async () => {
    let resolveForecast!: (value: { response: { ok: boolean }; body: { payload: QuarterlyForecastPayload } }) => void;
    mockRequestQuarterlyForecast.mockImplementationOnce(() => new Promise((resolve) => { resolveForecast = resolve; }));
    const updated = { ...forecast, quarters: forecast.quarters.map((quarter) => ({ ...quarter, totalCentavos: 2_000_000 })) };
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);
    await waitFor(() => expect(mockRequestQuarterlyForecast).toHaveBeenCalledTimes(1));
    fireEvent.press(view.getByLabelText("Show Q1 2027 forecast"));
    expect(view.getByText("PHP 16,500")).toBeTruthy();

    await act(async () => { resolveForecast({ response: { ok: true }, body: { payload: updated } }); });
    expect(view.getByText("PHP 20,000")).toBeTruthy();
    expect(view.getByText("Q1 2027 · Forecast")).toBeTruthy();
    expect(view.queryByText("Updating forecast…")).toBeNull();
  });

  it("retains stale charts when revalidation fails", async () => {
    mockGetSnapshot.mockResolvedValue({ ...snapshot, stale: true });
    mockRequestQuarterlyForecast.mockRejectedValue(new Error("offline"));
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(view.getByText("Forecast update failed. Your last forecast is still available.")).toBeTruthy());
    expect(view.getByText("PHP 15,000")).toBeTruthy();
    expect(view.getByText("Forecast data may be out of date.")).toBeTruthy();
    expect(view.queryByText("Updating forecast…")).toBeNull();
  });

  it("shows the saved forecast offline without requesting a new one", async () => {
    mockOnline = false;
    mockGetSnapshot.mockResolvedValue({ ...snapshot, stale: true });
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(view.getByText("You're offline. Showing your last saved forecast.")).toBeTruthy());
    expect(view.getByText("PHP 15,000")).toBeTruthy();
    expect(view.queryByText("Updating forecast…")).toBeNull();
    expect(mockRequestQuarterlyForecast).not.toHaveBeenCalled();
  });

  it("asks for a connection offline when no forecast is saved", async () => {
    mockOnline = false;
    mockGetSnapshot.mockResolvedValue(null);
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(view.getByText("Connect to the internet to get your spending forecast.")).toBeTruthy());
    expect(view.queryByLabelText("Loading spending forecast")).toBeNull();
    expect(mockRequestQuarterlyForecast).not.toHaveBeenCalled();
  });

  it("revalidates the saved forecast once the connection returns", async () => {
    mockOnline = false;
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);
    await waitFor(() => expect(view.getByText("You're offline. Showing your last saved forecast.")).toBeTruthy());

    mockOnline = true;
    view.rerender(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);
    await waitFor(() => expect(mockRequestQuarterlyForecast).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.queryByText("You're offline. Showing your last saved forecast.")).toBeNull());
    expect(mockUpsertSnapshot).toHaveBeenCalledWith("user-1", "forecast_quarterly", expect.objectContaining({ modelVersion: forecast.modelVersion }));
  });

  it("clears the previous account's forecast immediately when the account changes", async () => {
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);
    await waitFor(() => expect(view.getByText("PHP 15,000")).toBeTruthy());
    mockGetSnapshot.mockReturnValue(new Promise(() => {}));

    view.rerender(<SpendingForecastScreen userId="user-2" accessToken="other-token" embedded />);
    expect(view.queryByText("PHP 15,000")).toBeNull();
    expect(view.getByLabelText("Loading spending forecast")).toBeTruthy();
    view.unmount();
  });

  it("requests a fresh forecast even when the cache cannot be read", async () => {
    mockGetSnapshot.mockRejectedValue(new Error("cache unavailable"));
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(view.getByText("PHP 15,000")).toBeTruthy());
    expect(view.queryByText("Forecast information is unavailable.")).toBeNull();
    expect(mockRequestQuarterlyForecast).toHaveBeenCalledTimes(1);
  });

  it("shows a retry message when the first forecast fails without cached data", async () => {
    mockGetSnapshot.mockResolvedValue(null);
    mockRequestQuarterlyForecast.mockRejectedValue(new Error("offline"));
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(view.getByText("Forecast update failed. Try refreshing again.")).toBeTruthy());
    expect(view.queryByLabelText("Loading spending forecast")).toBeNull();
    expect(view.queryByText("Forecast update failed. Your last forecast is still available.")).toBeNull();
  });

  it("shows actual quarters before the forecast, starting on the first forecast quarter", async () => {
    mockListQuarterlySpending.mockResolvedValue([
      { quarter: "2026Q2", totalCentavos: 0, categories: [] },
      { quarter: "2026Q3", totalCentavos: 1_400_000, categories: [{ category: "food", amountCentavos: 900_000 }, { category: "transport", amountCentavos: 500_000 }] },
    ]);
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    // The empty quarter before recording began is dropped; the forecast tab stays selected.
    await waitFor(() => expect(view.getByLabelText("Actual spending for 1 quarters and projected spending for 2 quarters")).toBeTruthy());
    expect(mockPastQuarters).toHaveBeenCalledWith(6);
    expect(mockListQuarterlySpending).toHaveBeenCalledWith("user-1", ["2025Q2", "2025Q3", "2025Q4", "2026Q1", "2026Q2", "2026Q3"]);
    expect(view.getByText("Q4 2026 · Forecast")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Show Q1 2027 forecast"));
    expect(view.getByText("Q1 2027 · Forecast")).toBeTruthy();
  });

  it("forecasts billers and remittances at their scheduled amounts, outside the HFCE model", async () => {
    const remittance = { frequency: "semi_monthly", dueDayOfMonth: 1, dueSecondDayOfMonth: 16, dueDayOfWeek: null, dueMonth: null, startsOn: "2025-09-01", endsOn: null, amountCentavos: 1_800_000 };
    mockListScheduledPayments.mockResolvedValue([remittance]);
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(mockUpsertSnapshot).toHaveBeenCalled());
    expect(mockListForecastTransactions).toHaveBeenCalledWith("user-1", { fromDate: "2025-10-01", excludeScheduledPayments: true, excludeUnusualSpending: true });
    const saved = mockUpsertSnapshot.mock.calls[0]![2] as QuarterlyForecastPayload;
    // Six due dates a quarter at PHP 18,000, the same in every quarter.
    for (const quarter of saved.quarters) expect(quarter.categories).toContainEqual({ category: "billers_remittances", amountCentavos: 10_800_000 });
    expect(saved.quarters[0]!.totalCentavos).toBe(1_500_000 + 10_800_000);
    expect(categorySeries(saved).find((line) => line.key === "billers_remittances")?.label).toBe("Billers & Remittances");
    view.unmount();
  });

  it("saves Groq's wording of the notes and shows it in place of the app's own", async () => {
    const notes = forecastInterpretation(forecast);
    const rewritten = notes.map((note, index) => `Friendly note ${index + 1}`);
    mockRequestForecastInterpretation.mockResolvedValue({ response: { ok: true }, body: { payload: { notes: rewritten } } });
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(view.getByText("Friendly note 1")).toBeTruthy());
    expect(mockRequestForecastInterpretation).toHaveBeenCalledWith("token", notes, expect.any(AbortSignal));
    expect(mockUpsertSnapshot).toHaveBeenLastCalledWith("user-1", "forecast_quarterly", { ...forecast, interpretation: rewritten });
  });

  it("keeps the app's own notes when Groq is unavailable", async () => {
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(mockRequestForecastInterpretation).toHaveBeenCalled());
    expect(mockUpsertSnapshot).toHaveBeenCalledTimes(1);
    expect(view.getByText(forecastInterpretation(forecast)[0]!)).toBeTruthy();
    expect(view.queryByText("Forecast update failed. Your last forecast is still available.")).toBeNull();
  });

  it("caches the quarterly forecast and shows the selected quarter's total and categories", async () => {
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(mockUpsertSnapshot).toHaveBeenCalledWith("user-1", "forecast_quarterly", forecast));
    expect(view.getByText("Spending forecast")).toBeTruthy();
    expect(view.getByText("October 1 to December 31, 2026")).toBeTruthy();
    expect(view.getByText("PHP 15,000")).toBeTruthy();
    expect(view.getByLabelText("Choose spending category: Total")).toBeTruthy();

    fireEvent.press(view.getByLabelText("Show Q1 2027 forecast"));
    expect(view.getByText("January 1 to March 31, 2027")).toBeTruthy();
    expect(view.getByText("PHP 16,500")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Choose spending category: Total"));
    fireEvent.press(view.getByRole("radio", { name: "Food and groceries" }));
    expect(view.getByText("PHP 11,000")).toBeTruthy();
  });

  it("shows the unavailable reason instead of charts", async () => {
    mockGetSnapshot.mockResolvedValue(null);
    mockRequestQuarterlyForecast.mockResolvedValue({ response: { ok: true }, body: { payload: null, reason: "NO_COMPLETED_MONTH", message: "Your spending forecast will be ready after your first full month of recorded expenses." } });
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(view.getByText(/first full month/)).toBeTruthy());
    expect(view.queryByText("Total projected spending")).toBeNull();
  });

  it("rebuilds a zero forecast from newly synced regular spending when reports refresh", async () => {
    const zero = { ...forecast, quarters: forecast.quarters.map((quarter) => ({ ...quarter, totalCentavos: 0, categories: [{ category: "communication", amountCentavos: 0 }] })) };
    const corrected = { ...forecast, quarters: forecast.quarters.map((quarter) => ({ ...quarter, totalCentavos: 219_600, categories: [{ category: "communication", amountCentavos: 219_600 }] })) };
    mockGetSnapshot.mockResolvedValue({ ...snapshot, payload_json: JSON.stringify(zero) });
    mockRequestQuarterlyForecast.mockResolvedValueOnce({ response: { ok: true }, body: { payload: zero } }).mockResolvedValue({ response: { ok: true }, body: { payload: corrected } });
    mockUpsertSnapshot.mockImplementation(async (_userId: string, _source: string, payload: QuarterlyForecastPayload) => {
      mockGetSnapshot.mockResolvedValue({ ...snapshot, payload_json: JSON.stringify(payload) });
    });
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" refreshKey={0} embedded />);
    await waitFor(() => expect(mockUpsertSnapshot).toHaveBeenCalledWith("user-1", "forecast_quarterly", zero));
    const regularSpending = [
      { transactionId: "phone-july", date: "2026-07-15", amount: 665, category: "communication", transactionType: "expense" },
      { transactionId: "phone-august", date: "2026-08-15", amount: 770, category: "communication", transactionType: "expense" },
      { transactionId: "phone-september", date: "2026-09-15", amount: 630, category: "communication", transactionType: "expense" },
    ];
    mockListForecastTransactions.mockResolvedValue(regularSpending);
    view.rerender(<SpendingForecastScreen userId="user-1" accessToken="token" refreshKey={1} embedded />);
    await waitFor(() => expect(mockRequestQuarterlyForecast).toHaveBeenLastCalledWith("token", { historicalTransactions: regularSpending }, expect.any(AbortSignal)));
    await waitFor(() => expect(mockUpsertSnapshot).toHaveBeenLastCalledWith("user-1", "forecast_quarterly", corrected));
    expect(view.getByText("PHP 2,196")).toBeTruthy();
  });

  it("opens on the total and preserves the quarter when switching categories", async () => {
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);
    await waitFor(() => expect(view.getByLabelText("Choose spending category: Total")).toBeTruthy());
    expect(view.getByLabelText("Total projected spending for 2 quarters")).toBeTruthy();
    expect(view.queryByText("Transportation")).toBeNull();
    fireEvent.press(view.getByLabelText("Show Q1 2027 forecast"));
    fireEvent.press(view.getByLabelText("Choose spending category: Total"));
    expect(view.getByLabelText("Choose spending category: Total").props.accessibilityState.expanded).toBe(true);
    fireEvent.press(view.getByRole("radio", { name: "Food and groceries" }));
    expect(view.getByLabelText("Food and groceries spending over 2 quarters")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Choose spending category: Food and groceries"));
    fireEvent.press(view.getByRole("radio", { name: "Transportation" }));
    expect(view.getByLabelText("Transportation spending over 2 quarters")).toBeTruthy();
    expect(view.queryByLabelText("Food and groceries spending over 2 quarters")).toBeNull();
    expect(view.getByText("PHP 5,500")).toBeTruthy();
    expect(view.queryByText("PHP 11,000")).toBeNull();
    expect(view.getByLabelText("Choose spending category: Transportation").props.accessibilityState.expanded).toBe(false);
    expect(view.queryByRole("radio", { name: "Food and groceries" })).toBeNull();
    fireEvent.press(view.getByLabelText("Choose spending category: Transportation"));
    expect(view.getByRole("radio", { name: "Food and groceries" })).toBeTruthy();
    fireEvent.press(view.getByLabelText("Choose spending category: Transportation"));
    expect(view.queryByRole("radio", { name: "Food and groceries" })).toBeNull();
  });

  it("does not let a late response overwrite a forecast refreshed after sync", async () => {
    let resolveOld!: (value: { response: { ok: boolean }; body: { payload: QuarterlyForecastPayload } }) => void;
    mockRequestQuarterlyForecast.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" refreshKey={0} embedded />);
    await waitFor(() => expect(mockRequestQuarterlyForecast).toHaveBeenCalledTimes(1));
    const oldSignal = mockRequestQuarterlyForecast.mock.calls[0]![2];
    view.rerender(<SpendingForecastScreen userId="user-1" accessToken="token" refreshKey={1} embedded />);
    await waitFor(() => expect(mockUpsertSnapshot).toHaveBeenCalledWith("user-1", "forecast_quarterly", forecast));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => { resolveOld({ response: { ok: true }, body: { payload: { ...forecast, quarters: [] } } }); });
    expect(mockUpsertSnapshot).toHaveBeenCalledTimes(1);
    expect(view.queryByText("Forecast update failed. Your last forecast is still available.")).toBeNull();
  });

  it("allows scheduled bills and remittances to be selected and charted", async () => {
    mockListScheduledPayments.mockResolvedValue([{ frequency: "monthly", dueDayOfMonth: 1, startsOn: "2025-09-01", endsOn: null, amountCentavos: 100_000 }]);
    mockUpsertSnapshot.mockImplementationOnce(async (_userId: string, _source: string, payload: QuarterlyForecastPayload) => {
      mockGetSnapshot.mockResolvedValue({ ...snapshot, payload_json: JSON.stringify(payload) });
    });
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);
    await waitFor(() => expect(mockUpsertSnapshot).toHaveBeenCalled());
    fireEvent.press(view.getByLabelText("Choose spending category: Total"));
    fireEvent.press(view.getByRole("radio", { name: "Billers & Remittances" }));
    expect(view.getByLabelText("Billers & Remittances spending over 2 quarters")).toBeTruthy();
    expect(view.getByText("PHP 3,000")).toBeTruthy();
    expect(view.getByText("Based on your scheduled bills and remittances.")).toBeTruthy();
  });
});

describe("forecastReliabilityNote", () => {
  it.each([
    [{ quality: "INSUFFICIENT_DATA", seasonalUncertainty: true }, "Provisional forecast"],
    [{ quality: "PERSONALIZED", seasonalUncertainty: true }, "Seasonal changes aren't shown yet"],
  ] as const)("explains how far to trust a forecast with %o", (flags, text) => {
    expect(forecastReliabilityNote({ ...forecast, ...flags })).toContain(text);
  });

  it("adds no note for a full year of history or an older snapshot", () => {
    expect(forecastReliabilityNote({ ...forecast, quality: "PERSONALIZED", seasonalUncertainty: false })).toBeNull();
    expect(forecastReliabilityNote(forecast)).toBeNull();
  });
});

describe("categorySeries", () => {
  it("keeps every category selectable with its own amounts", () => {
    const categories = ["food", "transport", "health", "education", "communication", "clothing_footwear", "recreation_culture", "alcohol_tobacco", "restaurants_hotels"];
    const series = categorySeries({
      ...forecast,
      quarters: [{ quarter: "2026Q4", totalCentavos: 4_500, categories: categories.map((category, index) => ({ category, amountCentavos: (categories.length - index) * 100 })) }],
    });

    expect(series).toHaveLength(9);
    expect(series.map((line) => line.key)).toEqual(categories);
    expect(series.at(-1)).toEqual(expect.objectContaining({ key: "restaurants_hotels", label: "Eating out and hotels", values: [100] }));
    expect(series.reduce((sum, line) => sum + line.values[0]!, 0)).toBe(4_500);
  });
});

describe("forecastInterpretation", () => {
  it("describes the trend, costliest stretch, biggest expense, and what changes in everyday words", () => {
    expect(forecastInterpretation({
      ...forecast,
      quarters: [
        { quarter: "2026Q4", totalCentavos: 1_500_000, categories: [{ category: "food", amountCentavos: 1_000_000 }, { category: "transport", amountCentavos: 500_000 }] },
        { quarter: "2027Q1", totalCentavos: 1_650_000, categories: [{ category: "food", amountCentavos: 1_200_000 }, { category: "transport", amountCentavos: 450_000 }] },
      ],
    })).toEqual([
      "Your spending will likely go up. Every 3 months, it may go from about PHP 15,000 (Oct–Dec 2026) to PHP 16,500 (Jan–Mar 2027).",
      "Your most expensive stretch will likely be Jan–Mar 2027, at about PHP 16,500. Try to save a little extra before then.",
      "Food and groceries is your biggest expense, about 7 of every 10 pesos you spend.",
      "By Jan–Mar 2027, you may spend about PHP 2,000 more on food and groceries every 3 months.",
      "You may spend about PHP 500 less on transportation every 3 months by Jan–Mar 2027.",
    ]);
  });

  it("says flat spending stays about the same and skips the costliest-stretch note", () => {
    const flat = { quarter: "2026Q4", totalCentavos: 1_000_000, categories: [{ category: "food", amountCentavos: 1_000_000 }] };
    expect(forecastInterpretation({ ...forecast, quarters: [flat, { ...flat, quarter: "2027Q1" }] })).toEqual([
      "Your spending will likely stay about the same, around PHP 10,000 every 3 months.",
      "Food and groceries is your biggest expense, almost every peso you spend.",
    ]);
  });
});
