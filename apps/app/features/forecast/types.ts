export type ForecastHorizon = "next_day" | "weekly" | "monthly" | "yearly";

export type ForecastPoint = {
  label: string;
  projected_balance_centavos: number;
  income_centavos: number;
  expense_centavos: number;
};

export type ForecastHorizonResult = {
  key: ForecastHorizon;
  label: string;
  period: string;
  points: ForecastPoint[];
};

export type ForecastPayload = {
  projected_balance_centavos: number | null;
  income_centavos: number | null;
  expense_centavos: number | null;
  categories: { label: string; amount_centavos: number }[];
  expected_events: { label: string; date: string }[];
  insights: string[];
  text: string | null;
  period: string | null;
  freshness: string | null;
  confidence: string | null;
  horizons: ForecastHorizonResult[];
};
