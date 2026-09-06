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
};