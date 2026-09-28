import { createHmac } from "node:crypto";
import { jest } from "@jest/globals";
import { ForecastUpstreamError, ForecastValidationError, getMlForecast, mapMlForecast, parseForecastRequest } from "../../services/forecastService";

const transaction = {
  transactionId: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be",
  date: "2026-06-04",
  amount: 245.5,
  category: "food",
  transactionType: "expense",
};

const currentQuarterTransaction = {
  ...transaction,
  transactionId: "a9df3d82-b64a-4b25-b8aa-dd36f70a42be",
  date: "2026-09-04",
};

const currentOnlyCategoryTransaction = {
  ...currentQuarterTransaction,
  transactionId: "c9df3d82-b64a-4b25-b8aa-dd36f70a42be",
  category: "health",
};

const mlResponse = {
  response_id: "response-1",
  request_id: "user-1",
  user_id: "user-1",
  forecasts: [{ category: "food", month: "2026-10", quarter: "2026Q4", amount: 8500.25, user_baseline_amount: 7000, hfce_multiplier: 1.214321, hfce_forecast_amount_million_php: 12345.67, explanation: "Personalized food forecast." }],
  model_version: "hfce-sarima-v4-category-quarterly",
  status: "SUCCESS",
  metadata: { processing_time_ms: 4.2, model_version: "hfce-sarima-v4-category-quarterly", strategy_used: "user_quarterly_baseline_times_hfce_category_multiplier" },
};

const alertClient = {
  from: () => ({
    select: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }) }),
  }),
} as never;

const unexpectedTransaction = {
  ...transaction,
  transactionId: "9d58db7f-e411-4e5c-8e64-efdcadbc8a8c",
};

const expectedTransaction = {
  ...transaction,
  transactionId: "d49ba029-d863-4e93-a1a8-d0594d5f26c4",
};

describe("forecast ML adapter", () => {
  afterEach(() => { delete process.env.FORECASTING_ML_BASE_URL; delete process.env.ODIN_TRUSTED_HISTORY_SHARED_SECRET; });

  it("validates transaction history without the retired horizon and level controls", () => {
    expect(parseForecastRequest({ historicalTransactions: [transaction] })).toEqual({ historicalTransactions: [transaction] });
    expect(() => parseForecastRequest({ historicalTransactions: [] })).toThrow(ForecastValidationError);
  });

  it("derives supported categories and maps the HFCE quarterly response", async () => {
    process.env.FORECASTING_ML_BASE_URL = "http://ml.internal/";
    process.env.ODIN_TRUSTED_HISTORY_SHARED_SECRET = "test-secret";
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => mlResponse });
    const result = await getMlForecast("user-1", { historicalTransactions: [transaction, currentQuarterTransaction, currentOnlyCategoryTransaction] }, alertClient, fetcher);
    expect(fetcher).toHaveBeenCalledWith("http://ml.internal/api/v1/forecast/predict", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "X-Odin-User-Id": "user-1", "X-Odin-History-Source": "odin_api" }) }));
    const requestBody = JSON.parse(fetcher.mock.calls[0]![1].body);
    expect(requestBody).toEqual(expect.objectContaining({ user_id: "user-1", categories: ["food"] }));
    expect(requestBody.historical_transactions).toEqual(expect.arrayContaining([expect.objectContaining({ transaction_id: transaction.transactionId, category: "food" })]));
    expect(fetcher.mock.calls[0]![1].headers["X-Odin-History-Signature"]).toBe(createHmac("sha256", "test-secret").update(`odin_api:user-1:${fetcher.mock.calls[0]![1].body}`).digest("hex"));
    expect(result).toEqual(expect.objectContaining({ status: "SUCCESS", forecasts: [{ category: "food", month: "2026-10", quarter: "2026Q4", amountCentavos: 850025, userBaselineCentavos: 700000, hfceMultiplier: 1.214321, hfceForecastAmountMillionPhp: 12345.67, explanation: "Personalized food forecast." }] }));
  });

  it("rejects malformed upstream responses and upstream errors", async () => {
    expect(() => mapMlForecast({ ...mlResponse, status: "FAILURE" })).toThrow(ForecastUpstreamError);
    process.env.FORECASTING_ML_BASE_URL = "http://ml.internal";
    process.env.ODIN_TRUSTED_HISTORY_SHARED_SECRET = "test-secret";
    await expect(getMlForecast("user-1", { historicalTransactions: [transaction, currentQuarterTransaction] }, alertClient, jest.fn().mockResolvedValue({ ok: false, status: 422 }))).rejects.toMatchObject({ status: 422 });
    await expect(getMlForecast("user-1", { historicalTransactions: [transaction, currentQuarterTransaction] }, alertClient, jest.fn().mockRejectedValue(new Error("offline")))).rejects.toMatchObject({ status: 503 });
  });

  it("omits anomaly alerts from forecast history unless marked expected", async () => {
    process.env.FORECASTING_ML_BASE_URL = "http://ml.internal";
    process.env.ODIN_TRUSTED_HISTORY_SHARED_SECRET = "test-secret";
    const unexpectedAlertClient = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ data: [
          { transaction_id: unexpectedTransaction.transactionId, metadata: {} },
          { transaction_id: expectedTransaction.transactionId, metadata: { forecast_excluded: false } },
        ], error: null }) }) }) }),
      }),
    } as never;
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => mlResponse });

    await getMlForecast("user-1", { historicalTransactions: [transaction, currentQuarterTransaction, unexpectedTransaction, expectedTransaction] }, unexpectedAlertClient, fetcher);

    expect(JSON.parse(fetcher.mock.calls[0]![1].body).historical_transactions).toEqual([
      expect.objectContaining({ transaction_id: transaction.transactionId }),
      expect.objectContaining({ transaction_id: currentQuarterTransaction.transactionId }),
      expect.objectContaining({ transaction_id: expectedTransaction.transactionId }),
    ]);
  });

  it("batches anomaly-alert lookups for large forecast histories", async () => {
    process.env.FORECASTING_ML_BASE_URL = "http://ml.internal";
    process.env.ODIN_TRUSTED_HISTORY_SHARED_SECRET = "test-secret";
    const inQuery = jest.fn().mockResolvedValue({ data: [], error: null });
    const largeHistoryAlertClient = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ in: inQuery }) }) }),
      }),
    } as never;
    const historicalTransactions = Array.from({ length: 379 }, (_, index) => ({
      ...transaction,
      transactionId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    }));
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => mlResponse });

    await getMlForecast(
      "user-1",
      { historicalTransactions: [...historicalTransactions, currentQuarterTransaction] },
      largeHistoryAlertClient,
      fetcher,
    );

    expect(inQuery).toHaveBeenCalledTimes(4);
    expect(inQuery.mock.calls.map(([, ids]) => ids.length)).toEqual([100, 100, 100, 80]);
  });
});
