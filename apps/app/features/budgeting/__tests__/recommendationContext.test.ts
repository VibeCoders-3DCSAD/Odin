jest.mock("../../../local-db/repositories/forecastTransactions", () => ({ listForecastTransactions: jest.fn() }));
jest.mock("../../forecast/api", () => ({ requestForecast: jest.fn() }));
jest.mock("../../../lib/api", () => ({ API_BASE_URL: "http://api.test", REQUEST_TIMEOUT_MS: 10_000 }));

import { listForecastTransactions } from "../../../local-db/repositories/forecastTransactions";
import { requestForecast } from "../../forecast/api";
import { loadBudgetRecommendationContext } from "../recommendationContext";

const history = [{ transactionId: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be", date: "2026-09-04", amount: 245.5, category: "Essentials", transactionType: "expense" as const, description: "do not forward" }];
const forecast = { forecasts: [{ category: "food", month: "2026-10", quarter: "2026Q4", amountCentavos: 12_345, userBaselineCentavos: 10_000, hfceMultiplier: 1.2, hfceForecastAmountMillionPhp: 1_234, explanation: "Personalized food forecast." }], modelVersion: "hfce-sarima-v4-category-quarterly", status: "SUCCESS" as const };

describe("budget recommendation context", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses posted history and a successful category-group forecast", async () => {
    (listForecastTransactions as jest.Mock).mockResolvedValue(history);
    (requestForecast as jest.Mock).mockResolvedValue({ response: { ok: true }, body: { payload: forecast } });
    await expect(loadBudgetRecommendationContext({ userId: "user-1", accessToken: "token" })).resolves.toEqual({ historicalTransactions: [{ transactionId: history[0]!.transactionId, date: history[0]!.date, amount: history[0]!.amount, category: history[0]!.category, transactionType: "expense" }] });
    expect(listForecastTransactions).toHaveBeenCalledWith("user-1", expect.objectContaining({ fromDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    expect(requestForecast).toHaveBeenCalledWith("token", expect.objectContaining({ historicalTransactions: [{ transactionId: history[0]!.transactionId, date: history[0]!.date, amount: history[0]!.amount, category: history[0]!.category, transactionType: "expense" }] }), undefined);
  });

  it("falls back to history alone for zero history or forecast failures", async () => {
    (listForecastTransactions as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce(history);
    await expect(loadBudgetRecommendationContext({ userId: "user-1", accessToken: "token" })).resolves.toEqual({ historicalTransactions: [] });
    (requestForecast as jest.Mock).mockRejectedValue(new Error("unavailable"));
    await expect(loadBudgetRecommendationContext({ userId: "user-1", accessToken: "token" })).resolves.toEqual({ historicalTransactions: [{ transactionId: history[0]!.transactionId, date: history[0]!.date, amount: history[0]!.amount, category: history[0]!.category, transactionType: "expense" }] });
  });

  it("preserves cancellation for the recommendation flow", async () => {
    jest.clearAllMocks();
    const controller = new AbortController();
    controller.abort();
    (listForecastTransactions as jest.Mock).mockResolvedValue(history);
    await expect(loadBudgetRecommendationContext({ userId: "user-1", accessToken: "token", signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(requestForecast).not.toHaveBeenCalled();
  });
});
