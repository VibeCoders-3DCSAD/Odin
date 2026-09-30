export type FinancialPlanStatus = "RECOMMENDATION_READY" | "INFEASIBLE";

export type FinancialPlanAllocation = {
  categoryId?: string | null;
  subcategoryId?: string | null;
  allocationRule: "FIXED" | "MINIMUM" | "FLEXIBLE";
  allocatedAmountCentavos: number;
  floorAmountCentavos: number;
  ceilingAmountCentavos?: number | null;
  forecastAmountCentavos?: number | null;
  subcategoryWeightBps?: number | null;
  label?: string;
};

export type FinancialPlanReservation = {
  debtAccountId?: string | null;
  creditCardStatementId?: string | null;
  savingsGoalId?: string | null;
  amountCentavos: number;
  dueDate?: string | null;
  label?: string;
};

export type FinancialPlanRecommendation = {
  status: FinancialPlanStatus;
  period: { start: string; end: string };
  inputSnapshot: {
    forecast: Record<string, unknown>;
    restrictions: Record<string, unknown>;
    obligations: Record<string, unknown>;
    debtRequirements: Record<string, unknown>;
    savingsRequirements: Record<string, unknown>;
    classification: Record<string, unknown>;
  };
  recommendation: {
    availableFundsCentavos: number;
    requiredFundsCentavos?: number;
    shortfallCentavos?: number;
    allocations: FinancialPlanAllocation[];
    debtReservations: FinancialPlanReservation[];
    debtSurplusCentavos?: number;
    savingsReservations: FinancialPlanReservation[];
    savingsSurplusCentavos?: number;
  };
  explanations: string[];
};
