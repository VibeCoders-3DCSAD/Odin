import { jest } from "@jest/globals";
import { ForecastUpstreamError, ForecastValidationError, getMlForecast, mapMlForecast, parseForecastRequest } from "../../services/forecastService";

const transaction = {
  transactionId: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be",
  date: "2026-09-04",
  amount: 245.5,
  category: "Essentials",
  transactionType: "expense",
};

const mlResponse = {
  forecasts: [{ date: "2026-10", amount: 8500.25, category: "Essentials" }],
  forecast_horizon: "MONTHLY",
  forecast_level: "CATEGORY_GROUP",
  confidence_intervals: { lower_80: 7000, upper_80: 10000, lower_95: 6000, upper_95: 11000 },
  model_version: "v2.4.0",
  status: "FALLBACK",
};

describe("forecast ML adapter", () => {
  afterEach(() => { delete process.env.FORECASTING_ML_BASE_URL; });

  it("validates only supported inputs", () => {
    expect(parseForecastRequest({ historicalTransactions: [transaction], forecastHorizon: "MONTHLY", forecastLevel: "CATEGORY_GROUP" })).toEqual({ historicalTransactions: [transaction], forecastHorizon: "MONTHLY", forecastLevel: "CATEGORY_GROUP" });
    expect(parseForecastRequest({ historicalTransactions: [transaction], forecastHorizon: "YEARLY", forecastLevel: "TOTAL" })).toEqual({ historicalTransactions: [transaction], forecastHorizon: "YEARLY", forecastLevel: "TOTAL" });
    expect(() => parseForecastRequest({ historicalTransactions: [], forecastHorizon: "MONTHLY", forecastLevel: "TOTAL" })).toThrow(ForecastValidationError);
    expect(() => parseForecastRequest({ historicalTransactions: [transaction], forecastHorizon: "DAILY", forecastLevel: "TOTAL" })).toThrow(ForecastValidationError);
    expect(() => parseForecastRequest({ historicalTransactions: [transaction], forecastHorizon: "MONTHLY", forecastLevel: "CATEGORY" })).toThrow(ForecastValidationError);
  });

  it("injects the authenticated user and maps amounts to centavos", async () => {
    process.env.FORECASTING_ML_BASE_URL = "http://ml.internal/";
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => mlResponse });
    const result = await getMlForecast("user-1", { historicalTransactions: [transaction], forecastHorizon: "MONTHLY", forecastLevel: "CATEGORY_GROUP" }, fetcher);
    expect(fetcher).toHaveBeenCalledWith("http://ml.internal/api/v1/forecast/predict", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }));
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual(expect.objectContaining({ user_id: "user-1", forecast_level: "CATEGORY_GROUP", historical_transactions: [expect.objectContaining({ transaction_id: transaction.transactionId, category: "Essentials" })] }));
    expect(result).toEqual(expect.objectContaining({ status: "FALLBACK", forecasts: [{ date: "2026-10", amountCentavos: 850025, category: "Essentials" }], confidenceInterval: expect.objectContaining({ lower80Centavos: 700000 }) }));
  });

  it("rejects malformed upstream responses and upstream errors", async () => {
    expect(() => mapMlForecast({ ...mlResponse, status: "FAILURE" })).toThrow(ForecastUpstreamError);
    process.env.FORECASTING_ML_BASE_URL = "http://ml.internal";
    await expect(getMlForecast("user-1", { historicalTransactions: [transaction], forecastHorizon: "MONTHLY", forecastLevel: "TOTAL" }, jest.fn().mockResolvedValue({ ok: false, status: 422 }))).rejects.toMatchObject({ status: 422 });
    await expect(getMlForecast("user-1", { historicalTransactions: [transaction], forecastHorizon: "MONTHLY", forecastLevel: "TOTAL" }, jest.fn().mockRejectedValue(new Error("offline")))).rejects.toMatchObject({ status: 503 });
  });
});
