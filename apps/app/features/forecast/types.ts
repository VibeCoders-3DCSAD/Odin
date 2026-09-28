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
  modelVersion: string;
  status: "SUCCESS";
};

export type ForecastContent = ForecastPayload;
