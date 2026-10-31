// Shared contracts for Past Financial Plans (spec §18.8, docs/plans/past-financial-plans.md).

export type CompletedFinancialPlanSummary = {
  id: string;
  periodStart: string;
  periodEnd: string;
  availableFundsCentavos: number;
  shortfallCentavos: number | null;
  plannedTotalCentavos: number;
};

export type PlanSpendingReviewRow = {
  allocationId: string;
  categoryId: string | null;
  subcategoryId: string | null;
  allocationRule: "FIXED" | "MINIMUM" | "FLEXIBLE";
  plannedCentavos: number;
  actualCentavos: number;
  /** plannedCentavos − actualCentavos; negative when the allocation was exceeded. */
  varianceCentavos: number;
  exceeded: boolean;
};

export type PlanSpendingReview = {
  planId: string;
  periodStart: string;
  periodEnd: string;
  rows: PlanSpendingReviewRow[];
  /** Spending in categories with no allocation (D4). */
  unplannedActualCentavos: number;
  plannedTotalCentavos: number;
  /** Includes unplanned spending (D4). */
  actualTotalCentavos: number;
  exceeded: boolean;
};

export type PlanCommitmentStatus = "met" | "partial" | "not_recorded" | "unplanned";

/** One row per savings goal; multiple reservations for the same goal are summed, dueDate is the earliest. */
export type PlanSavingsCommitmentRow = {
  savingsGoalId: string;
  reservedCentavos: number;
  /** Contributions only; withdrawals are ignored (D5). */
  actualCentavos: number;
  /** max(actual − reserved, 0); equals actual for unplanned rows. */
  additionalCentavos: number;
  status: PlanCommitmentStatus;
  dueDate: string | null;
};

/** One row per debt account or credit-card statement; exactly one of the two ids is set. */
export type PlanDebtCommitmentRow = {
  debtAccountId: string | null;
  creditCardStatementId: string | null;
  reservedCentavos: number;
  actualCentavos: number;
  additionalCentavos: number;
  status: PlanCommitmentStatus;
  dueDate: string | null;
};

export type PlanCommitmentReview = {
  planId: string;
  savings: PlanSavingsCommitmentRow[];
  debts: PlanDebtCommitmentRow[];
  totals: {
    savingsReservedCentavos: number;
    savingsActualCentavos: number;
    savingsAdditionalCentavos: number;
    debtReservedCentavos: number;
    debtActualCentavos: number;
    debtAdditionalCentavos: number;
  };
};
