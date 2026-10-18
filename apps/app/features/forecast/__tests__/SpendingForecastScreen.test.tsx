import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import SpendingForecastScreen from "../SpendingForecastScreen";
import { categorySeries, forecastInterpretation } from "../QuarterlyForecastCharts";
import type { QuarterlyForecastPayload } from "../types";

const mockGetSnapshot = jest.fn();
const mockUpsertSnapshot = jest.fn();
const mockListForecastTransactions = jest.fn();
const mockRequestQuarterlyForecast = jest.fn();
const mockRequestForecastInterpretation = jest.fn();

jest.mock("../../../local-db/repositories/dashboardSnapshots", () => ({
  getSnapshot: (...args: unknown[]) => mockGetSnapshot(...args),
  upsertSnapshot: (...args: unknown[]) => mockUpsertSnapshot(...args),
}));
jest.mock("../../../local-db/repositories/forecastTransactions", () => ({
  getForecastHistoryStartDate: () => "2025-10-01",
  listForecastTransactions: (...args: unknown[]) => mockListForecastTransactions(...args),
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
    jest.clearAllMocks();
    mockGetSnapshot.mockResolvedValue(snapshot);
    mockListForecastTransactions.mockResolvedValue([{ transactionId: "t-1", date: "2026-09-04", amount: 100, category: "food", transactionType: "expense" }]);
    mockRequestQuarterlyForecast.mockResolvedValue({ response: { ok: true }, body: { payload: forecast } });
    mockRequestForecastInterpretation.mockRejectedValue(new Error("offline"));
  });

  it("saves Groq's wording of the notes and shows it in place of the app's own", async () => {
    const notes = forecastInterpretation(forecast);
    const rewritten = notes.map((note, index) => `Friendly note ${index + 1}`);
    mockRequestForecastInterpretation.mockResolvedValue({ response: { ok: true }, body: { payload: { notes: rewritten } } });
    mockGetSnapshot.mockResolvedValueOnce(snapshot).mockResolvedValueOnce(snapshot).mockResolvedValue({ ...snapshot, payload_json: JSON.stringify({ ...forecast, interpretation: rewritten }) });
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(view.getByText("Friendly note 1")).toBeTruthy());
    expect(mockRequestForecastInterpretation).toHaveBeenCalledWith("token", notes);
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
    expect(view.getByText("Quarterly spending forecast")).toBeTruthy();
    expect(view.getByText("October 1 to December 31, 2026")).toBeTruthy();
    expect(view.getByText("PHP 15,000")).toBeTruthy();
    expect(view.getByText("Food and groceries")).toBeTruthy();
    expect(view.getByText("PHP 10,000")).toBeTruthy();

    fireEvent.press(view.getByLabelText("Show Q1 2027 forecast"));
    expect(view.getByText("January 1 to March 31, 2027")).toBeTruthy();
    expect(view.getByText("PHP 16,500")).toBeTruthy();
    expect(view.getByText("PHP 11,000")).toBeTruthy();
  });

  it("shows the unavailable reason instead of charts", async () => {
    mockGetSnapshot.mockResolvedValue(null);
    mockRequestQuarterlyForecast.mockResolvedValue({ response: { ok: true }, body: { payload: null, reason: "NO_COMPLETED_MONTH", message: "Your spending forecast will be ready after your first full month of recorded expenses." } });
    const view = render(<SpendingForecastScreen userId="user-1" accessToken="token" embedded />);

    await waitFor(() => expect(view.getByText(/first full month/)).toBeTruthy());
    expect(view.queryByText("Total projected spending")).toBeNull();
  });
});

describe("categorySeries", () => {
  it("folds categories past the seventh into Other so the quarter still adds up", () => {
    const categories = ["food", "transport", "health", "education", "communication", "clothing_footwear", "recreation_culture", "alcohol_tobacco", "restaurants_hotels"];
    const series = categorySeries({
      ...forecast,
      quarters: [{ quarter: "2026Q4", totalCentavos: 4_500, categories: categories.map((category, index) => ({ category, amountCentavos: (categories.length - index) * 100 })) }],
    });

    expect(series).toHaveLength(7);
    expect(series.at(-1)).toEqual(expect.objectContaining({ key: "other", label: "Other", values: [600] }));
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
