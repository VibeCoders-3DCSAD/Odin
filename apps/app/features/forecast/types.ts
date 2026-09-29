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
};

export type ForecastPayload = {
  forecasts: { category: string; month: string; quarter: string; amountCentavos: number; userBaselineCentavos: number; hfceMultiplier: number; hfceForecastAmountMillionPhp: number; explanation: string }[];
  snapshot: { month: string; totalAmountCentavos: number; categoryForecasts: { category: string; amountCentavos: number }[]; modelVersion: string; generatedAt: string; quality: "PERSONALIZED" | "FALLBACK" | "COLD_START" | "INSUFFICIENT_DATA" };
  modelVersion: string;
  status: "SUCCESS";
};

export type ForecastContent = ForecastPayload;
