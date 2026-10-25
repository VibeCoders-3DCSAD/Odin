export type ForecastTransaction = {
  transactionId: string;
  date: string;
  amount: number;
  category: string;
  transactionType: "income" | "expense";
  description?: string;
  // An unusual payment the user said happens once a year, so the forecast repeats it in that month.
  recurrence?: "yearly";
};

export type ForecastRequest = {
  historicalTransactions: ForecastTransaction[];
  // YYYY-MM-DD day to forecast from instead of today; the quarterly forecast then starts in that month.
  asOf?: string;
};

export type ForecastPayload = {
  forecasts: { category: string; month: string; quarter: string; amountCentavos: number; userBaselineCentavos: number; hfceMultiplier: number; hfceForecastAmountMillionPhp: number; explanation: string }[];
  snapshot: { month: string; totalAmountCentavos: number; categoryForecasts: { category: string; amountCentavos: number }[]; modelVersion: string; generatedAt: string; quality: "PERSONALIZED" | "FALLBACK" | "COLD_START" | "INSUFFICIENT_DATA" };
  modelVersion: string;
  status: "SUCCESS";
};

export type ForecastContent = ForecastPayload;

type CategoryAmount = { category: string; amountCentavos: number };

export type QuarterlyForecastPayload = {
  quarters: { quarter: string; totalCentavos: number; categories: CategoryAmount[] }[];
  // Each forecast month (YYYY-MM). Older snapshots lack them.
  months?: { month: string; totalCentavos: number; categories: CategoryAmount[] }[];
  modelVersion: string;
  generatedAt: string;
  // INSUFFICIENT_DATA under six months of history; seasonalUncertainty under twelve. Older snapshots lack them.
  quality?: "PERSONALIZED" | "FALLBACK" | "COLD_START" | "INSUFFICIENT_DATA";
  baselineMethod?: "same_period_last_year" | "median_monthly" | "recency_weighted_provisional";
  seasonalUncertainty?: boolean;
  // Groq's wording of the forecast notes, saved once it arrives.
  interpretation?: string[];
};

export type ForecastUnavailableReason = "NO_COMPLETED_MONTH" | "NO_RECENT_SPENDING";
