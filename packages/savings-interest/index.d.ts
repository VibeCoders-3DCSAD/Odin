export type SavingsInterestReference = {
  balanceBasis: "daily_balance" | "average_daily_balance" | null;
  method: "simple" | "compound" | "none" | null;
  rateStructure: "fixed" | "tiered" | null;
  notes: string | null;
  schedule?: SavingsInterestSchedule | null;
  configuration?: SavingsInterestConfiguration | null;
};

export function normalizeSavingsInterestReference(value: unknown): SavingsInterestReference | null;

export type SavingsInterestTier = { minimumBalanceCentavos: number; interestRateBps: number };
export type SavingsInterestSchedule = {
  startsOn: string;
  frequency: "daily" | "monthly" | "quarterly" | "yearly";
  withholdingTaxBps: number;
  tiers: SavingsInterestTier[];
};
export function validateScheduledInterest(reference: SavingsInterestReference | null | undefined, annualRateBps: number | null | undefined): void;

export type SavingsInterestConfiguration = {
  version: 1;
  calculationFrequency: "daily";
  creditFrequency: "daily" | "monthly" | "quarterly" | "yearly" | "custom";
  creditIntervalDays: number | null;
  postingMode: "period_end" | "day_of_month" | "specific_date";
  postingDay: number | null;
  postingDate: string | null;
  startsOn: string;
  startingBalanceCentavos: number | null;
  averagingPeriod: "calendar_month" | "credit_period" | "custom";
  averagingIntervalDays: number | null;
  minimumQualifyingBalanceCentavos: number | null;
  maximumInterestBearingBalanceCentavos: number | null;
  dayCountBasis: "actual_365" | "actual_366" | "actual_actual";
  taxEnabled: boolean;
  withholdingTaxBps: number;
  /** Legacy compatibility field; normalization always disables it. */
  autoProject: boolean;
  stoppingPolicy: "preserve" | "settle" | "discard_projection";
  showBreakdown: boolean;
  rateHistory: { effectiveOn: string; rateBps: number }[];
};
export function normalizeSavingsInterestConfiguration(value: unknown): SavingsInterestConfiguration;
