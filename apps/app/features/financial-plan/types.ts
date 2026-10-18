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
  spentAmountCentavos?: number;
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

export type FinancialPlanSurplusRecommendation = {
  unallocatedSurplusCentavos: number;
  reasonCode: "NEGATIVE_FINANCIAL_MARGIN" | "EMERGENCY_FUND_INADEQUATE" | "DEBT_SIGNAL" | "USER_DIRECTED" | "ASSESSMENT_UNAVAILABLE" | "ASSESSMENT_STALE" | "ASSESSMENT_INSUFFICIENT_DATA";
  assessmentStatus: "applied" | "unavailable" | "stale" | "insufficient_data";
  advisoryDestination: { type: "emergency_fund"; savingsGoalId: string; label?: string } | { type: "debt"; debtAccountId: string; label?: string } | null;
  assessmentEvidence: Record<string, unknown> | null;
};

export type FinancialPlanRecommendation = {
  status: FinancialPlanStatus;
  period: { start: string; end: string };
  inputSnapshot: {
    plannedAmountCentavos: number;
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
    surplusRecommendation?: FinancialPlanSurplusRecommendation;
  };
  explanations: string[];
  // Opaque server evidence, sent back to POST /financial-plans/explanations for the AI explanations.
  explanationRequest?: unknown;
};
