export const FORECAST_HORIZONS = ["WEEKLY", "SEMI_MONTHLY", "MONTHLY", "YEARLY"] as const;
export const FORECAST_LEVELS = ["TOTAL", "CATEGORY_GROUP"] as const;

export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];
export type ForecastLevel = (typeof FORECAST_LEVELS)[number];

export type ForecastTransaction = {
  transactionId: string;
  date: string;
  amount: number;
  category: string;
  transactionType: "income" | "expense";
  description?: string;
};

export type ForecastRequest = {
  historicalTransactions: ForecastTransaction[];
  forecastHorizon: ForecastHorizon;
  forecastLevel: ForecastLevel;
};

export type ForecastPayload = {
  forecasts: { date: string; amountCentavos: number; category: string | null }[];
  forecastHorizon: ForecastHorizon;
  forecastLevel: ForecastLevel;
  confidenceInterval: {
    lower80Centavos: number;
    upper80Centavos: number;
    lower95Centavos: number;
    upper95Centavos: number;
  };
  modelVersion: string;
  status: "SUCCESS" | "FALLBACK";
};

type MlForecastResponse = {
  forecasts: { date: string; amount: number; category?: string | null }[];
  forecast_horizon: ForecastHorizon;
  forecast_level: ForecastLevel;
  confidence_intervals: {
    lower_80: number;
    upper_80: number;
    lower_95: number;
    upper_95: number;
  };
  model_version: string;
  status: "SUCCESS" | "FALLBACK";
};

const MAX_TRANSACTIONS = 500;
const MAX_TEXT_LENGTH = 160;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ForecastValidationError extends Error {}
export class ForecastUpstreamError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function parseForecastRequest(value: unknown): ForecastRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ForecastValidationError("Forecast request must be an object");
  }
  const input = value as Record<string, unknown>;
  const horizon = input.forecastHorizon;
  const level = input.forecastLevel;
  if (!(FORECAST_HORIZONS as readonly unknown[]).includes(horizon)) {
    throw new ForecastValidationError("forecastHorizon is invalid");
  }
  if (!(FORECAST_LEVELS as readonly unknown[]).includes(level)) {
    throw new ForecastValidationError("forecastLevel is invalid");
  }
  if (!Array.isArray(input.historicalTransactions) || input.historicalTransactions.length === 0 || input.historicalTransactions.length > MAX_TRANSACTIONS) {
    throw new ForecastValidationError("historicalTransactions must contain between 1 and 500 transactions");
  }
  return {
    forecastHorizon: horizon as ForecastHorizon,
    forecastLevel: level as ForecastLevel,
    historicalTransactions: input.historicalTransactions.map(parseTransaction),
  };
}

function parseTransaction(value: unknown): ForecastTransaction {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ForecastValidationError("Transaction is invalid");
  const input = value as Record<string, unknown>;
  if (typeof input.transactionId !== "string" || !UUID.test(input.transactionId)) throw new ForecastValidationError("transactionId is invalid");
  if (typeof input.date !== "string" || !ISO_DATE.test(input.date) || Number.isNaN(Date.parse(`${input.date}T00:00:00Z`))) throw new ForecastValidationError("date is invalid");
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0) throw new ForecastValidationError("amount is invalid");
  if (typeof input.category !== "string" || !input.category.trim() || input.category.length > MAX_TEXT_LENGTH) throw new ForecastValidationError("category is invalid");
  if (input.transactionType !== "income" && input.transactionType !== "expense") throw new ForecastValidationError("transactionType is invalid");
  if (input.description != null && (typeof input.description !== "string" || input.description.length > MAX_TEXT_LENGTH)) throw new ForecastValidationError("description is invalid");
  return {
    transactionId: input.transactionId,
    date: input.date,
    amount: Math.round(input.amount * 100) / 100,
    category: input.category.trim(),
    transactionType: input.transactionType,
    ...(typeof input.description === "string" && input.description.trim() ? { description: input.description.trim() } : {}),
  };
}

export async function getMlForecast(userId: string, request: ForecastRequest, fetcher: typeof fetch = fetch): Promise<ForecastPayload> {
  const baseUrl = process.env.FORECASTING_ML_BASE_URL;
  if (!baseUrl) throw new ForecastUpstreamError(503, "Forecast service is unavailable");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/api/v1/forecast/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        user_id: userId,
        historical_transactions: request.historicalTransactions.map((transaction) => ({
          transaction_id: transaction.transactionId,
          date: transaction.date,
          amount: transaction.amount,
          category: transaction.category,
          transaction_type: transaction.transactionType,
          ...(transaction.description ? { description: transaction.description } : {}),
        })),
        forecast_horizon: request.forecastHorizon,
        forecast_level: request.forecastLevel,
      }),
    });
    if (!response.ok) throw new ForecastUpstreamError(response.status, "Forecast service rejected the request");
    return mapMlForecast(await response.json());
  } catch (error) {
    if (error instanceof ForecastUpstreamError) throw error;
    throw new ForecastUpstreamError(503, error instanceof Error && error.name === "AbortError" ? "Forecast service timed out" : "Forecast service is unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export function mapMlForecast(value: unknown): ForecastPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ForecastUpstreamError(502, "Forecast service returned an invalid response");
  const response = value as Record<string, unknown>;
  if (!(FORECAST_HORIZONS as readonly unknown[]).includes(response.forecast_horizon) || !(FORECAST_LEVELS as readonly unknown[]).includes(response.forecast_level) || (response.status !== "SUCCESS" && response.status !== "FALLBACK") || typeof response.model_version !== "string" || !response.model_version.trim() || !Array.isArray(response.forecasts)) {
    throw new ForecastUpstreamError(502, "Forecast service returned an invalid response");
  }
  const intervals = response.confidence_intervals;
  if (!intervals || typeof intervals !== "object" || Array.isArray(intervals)) throw new ForecastUpstreamError(502, "Forecast service returned an invalid response");
  const interval = intervals as Record<string, unknown>;
  const cents = (amount: unknown) => {
    if (typeof amount !== "number" || !Number.isFinite(amount)) throw new ForecastUpstreamError(502, "Forecast service returned an invalid response");
    return Math.round(amount * 100);
  };
  return {
    forecasts: response.forecasts.map((point) => {
      if (!point || typeof point !== "object" || Array.isArray(point)) throw new ForecastUpstreamError(502, "Forecast service returned an invalid response");
      const value = point as Record<string, unknown>;
      if (typeof value.date !== "string" || !value.date.trim() || (value.category != null && typeof value.category !== "string")) throw new ForecastUpstreamError(502, "Forecast service returned an invalid response");
      return { date: value.date, amountCentavos: cents(value.amount), category: value.category ?? null };
    }),
    forecastHorizon: response.forecast_horizon as ForecastHorizon,
    forecastLevel: response.forecast_level as ForecastLevel,
    confidenceInterval: { lower80Centavos: cents(interval.lower_80), upper80Centavos: cents(interval.upper_80), lower95Centavos: cents(interval.lower_95), upper95Centavos: cents(interval.upper_95) },
    modelVersion: response.model_version,
    status: response.status,
  };
}
