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

export type ForecastContent = ForecastPayload;
