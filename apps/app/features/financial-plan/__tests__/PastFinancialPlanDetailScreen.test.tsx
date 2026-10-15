import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import PastFinancialPlanDetailScreen from "../PastFinancialPlanDetailScreen";
import type { PlanCommitmentReview, PlanSpendingReview } from "../pastPlanTypes";

const mockGetFinancialPlan = jest.fn();
const mockGetFinancialPlanLabels = jest.fn();
const mockGetPlanSpendingReview = jest.fn();
const mockGetPlanCommitmentReview = jest.fn();

jest.mock("../../../local-db/repositories/financialPlans", () => ({
  getFinancialPlan: (...args: unknown[]) => mockGetFinancialPlan(...args),
  getFinancialPlanLabels: (...args: unknown[]) => mockGetFinancialPlanLabels(...args),
}));

jest.mock("../../../local-db/repositories/financialPlanSpendingReview", () => ({
  getPlanSpendingReview: (...args: unknown[]) => mockGetPlanSpendingReview(...args),
}));

jest.mock("../../../local-db/repositories/financialPlanCommitmentReview", () => ({
  getPlanCommitmentReview: (...args: unknown[]) => mockGetPlanCommitmentReview(...args),
}));

const plan = {
  id: "plan-1",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  inputSnapshot: {
    forecast: { modelVersion: "forecast-v3", quality: "HIGH" },
    classification: { status: "classified", assessed_at: "2026-08-28T03:00:00.000Z" },
  },
  recommendation: {
    availableFundsCentavos: 2_500_000,
    shortfallCentavos: 120_000,
    allocations: [{ categoryId: "food", allocationRule: "FLEXIBLE", allocatedAmountCentavos: 800_000, floorAmountCentavos: 0 }, { subcategoryId: "rent", allocationRule: "FIXED", allocatedAmountCentavos: 1_000_000, floorAmountCentavos: 1_000_000 }],
    debtReservations: [{ debtAccountId: "car-loan", amountCentavos: 300_000 }, { creditCardStatementId: "statement-1", amountCentavos: 150_000 }],
    savingsReservations: [{ savingsGoalId: "emergency", amountCentavos: 200_000 }],
  },
};

const spending: PlanSpendingReview = {
  planId: "plan-1",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  rows: [
    { allocationId: "plan-1:allocation:0", categoryId: "food", subcategoryId: null, allocationRule: "FLEXIBLE", plannedCentavos: 800_000, actualCentavos: 950_000, varianceCentavos: -150_000, exceeded: true },
    { allocationId: "plan-1:allocation:1", categoryId: null, subcategoryId: "rent", allocationRule: "FIXED", plannedCentavos: 1_000_000, actualCentavos: 1_000_000, varianceCentavos: 0, exceeded: false },
  ],
  unplannedActualCentavos: 45_000,
  plannedTotalCentavos: 1_800_000,
  actualTotalCentavos: 1_995_000,
  exceeded: true,
};

const commitments: PlanCommitmentReview = {
  planId: "plan-1",
  savings: [
    { savingsGoalId: "emergency", reservedCentavos: 200_000, actualCentavos: 250_000, additionalCentavos: 50_000, status: "met", dueDate: null },
    { savingsGoalId: "travel", reservedCentavos: 0, actualCentavos: 30_000, additionalCentavos: 30_000, status: "unplanned", dueDate: null },
  ],
  debts: [
    { debtAccountId: "car-loan", creditCardStatementId: null, reservedCentavos: 300_000, actualCentavos: 0, additionalCentavos: 0, status: "not_recorded", dueDate: "2026-09-15" },
    { debtAccountId: null, creditCardStatementId: "statement-1", reservedCentavos: 150_000, actualCentavos: 100_000, additionalCentavos: 0, status: "partial", dueDate: "2026-09-20" },
  ],
  totals: { savingsReservedCentavos: 200_000, savingsActualCentavos: 280_000, savingsAdditionalCentavos: 80_000, debtReservedCentavos: 450_000, debtActualCentavos: 100_000, debtAdditionalCentavos: 0 },
};

const labels = {
  categories: { food: "Food" },
  subcategories: { rent: "Rent" },
  debtAccounts: { "car-loan": "Car loan" },
  savingsGoals: { emergency: "Emergency fund", travel: "Travel" },
  creditCardStatements: { "statement-1": "Visa statement" },
  removedIds: ["rent", "travel"],
};

function renderScreen(onBack = jest.fn()) {
  return render(<PastFinancialPlanDetailScreen userId="user-1" planId="plan-1" onBack={onBack} />);
}

describe("PastFinancialPlanDetailScreen", () => {
  beforeEach(() => {
    mockGetFinancialPlan.mockReset().mockResolvedValue(plan);
    mockGetFinancialPlanLabels.mockReset().mockResolvedValue(labels);
    mockGetPlanSpendingReview.mockReset().mockResolvedValue(spending);
    mockGetPlanCommitmentReview.mockReset().mockResolvedValue(commitments);
  });

  it("renders every section from local data with user-scoped loads", async () => {
    const view = renderScreen();

    expect(view.getByText("Loading past plan...")).toBeTruthy();
    await waitFor(() => expect(view.getByText("September 2026")).toBeTruthy());

    expect(view.getByText("Plan period 2026-09-01 to 2026-09-30")).toBeTruthy();
    expect(view.getByText("Food")).toBeTruthy();
    expect(view.getByText("flexible allocation")).toBeTruthy();
    expect(view.getByText("Planned ₱8,000.00 · Actual ₱9,500.00")).toBeTruthy();
    expect(view.getByText("Variance -₱1,500.00")).toBeTruthy();
    expect(view.getByText("Unplanned spending")).toBeTruthy();
    expect(view.getByText("₱450.00")).toBeTruthy();
    expect(view.getByText("₱18,000.00")).toBeTruthy();
    expect(view.getByText("₱19,950.00")).toBeTruthy();
    expect(view.getByText("Emergency fund")).toBeTruthy();
    expect(view.getByText("Reserved ₱2,000.00 · Contributed ₱2,500.00")).toBeTruthy();
    expect(view.getByText("Met")).toBeTruthy();
    expect(view.getByText("Additional ₱500.00")).toBeTruthy();
    expect(view.getByText("Additional contribution")).toBeTruthy();
    expect(view.getByText("Visa statement")).toBeTruthy();
    expect(view.getByText("Partial")).toBeTruthy();
    expect(view.getByText("Reserved ₱1,500.00 · Paid ₱1,000.00")).toBeTruthy();
    expect(view.getByText("₱25,000.00")).toBeTruthy();
    expect(view.getByText("₱1,200.00")).toBeTruthy();
    expect(view.getByText("forecast-v3")).toBeTruthy();
    expect(view.getByText("HIGH")).toBeTruthy();
    expect(view.getByText("classified")).toBeTruthy();
    expect(view.getByText("August 28, 2026")).toBeTruthy();
    expect(view.getAllByRole("button")).toHaveLength(1);

    expect(mockGetFinancialPlan).toHaveBeenCalledWith("user-1", "plan-1");
    expect(mockGetPlanSpendingReview).toHaveBeenCalledWith("user-1", "plan-1");
    expect(mockGetPlanCommitmentReview).toHaveBeenCalledWith("user-1", "plan-1");
    const [labelUserId, labelPlan, labelOptions] = mockGetFinancialPlanLabels.mock.calls[0];
    expect(labelUserId).toBe("user-1");
    expect(labelOptions).toEqual({ includeDeleted: true });
    expect(labelPlan.recommendation.savingsReservations).toEqual(expect.arrayContaining([expect.objectContaining({ savingsGoalId: "travel" })]));
  });

  it("flags over-allocation and an over-plan verdict", async () => {
    const view = renderScreen();

    await waitFor(() => expect(view.getByText("Over allocation")).toBeTruthy());
    expect(view.getAllByText("Over allocation")).toHaveLength(1);
    expect(view.getByLabelText("Food is over allocation")).toBeTruthy();
    expect(view.getByText("Over plan")).toBeTruthy();
    expect(view.queryByText("Within plan")).toBeNull();
  });

  it("shows a within-plan verdict when spending stayed inside the plan", async () => {
    mockGetPlanSpendingReview.mockResolvedValue({ ...spending, rows: [spending.rows[1]], unplannedActualCentavos: 0, actualTotalCentavos: 1_000_000, exceeded: false });
    const view = renderScreen();

    await waitFor(() => expect(view.getByText("Within plan")).toBeTruthy());
    expect(view.queryByText("Over allocation")).toBeNull();
    expect(view.queryByText("Unplanned spending")).toBeNull();
  });

  it("says no payment was recorded and never calls a commitment missed", async () => {
    const view = renderScreen();

    await waitFor(() => expect(view.getByText("No payment recorded")).toBeTruthy());
    expect(view.getByText("Car loan")).toBeTruthy();
    expect(view.queryByText(/missed/i)).toBeNull();
    expect(view.queryByText(/withdraw/i)).toBeNull();
  });

  it("marks removed categories and goals", async () => {
    const view = renderScreen();

    await waitFor(() => expect(view.getByText("Rent (removed)")).toBeTruthy());
    expect(view.getByText("Travel (removed)")).toBeTruthy();
    expect(view.queryByText("Food (removed)")).toBeNull();
  });

  it("shows a not-found state when the plan is unavailable", async () => {
    mockGetFinancialPlan.mockResolvedValue(null);
    const view = renderScreen();

    await waitFor(() => expect(view.getByText("Plan not found")).toBeTruthy());
    expect(mockGetFinancialPlanLabels).not.toHaveBeenCalled();
  });

  it("shows an error state and retries loading", async () => {
    mockGetPlanCommitmentReview.mockRejectedValueOnce(new Error("database is locked"));
    const view = renderScreen();

    await waitFor(() => expect(view.getByText("Plan unavailable")).toBeTruthy());
    expect(view.queryByText(/database is locked/)).toBeNull();

    fireEvent.press(view.getByLabelText("Retry loading past plan"));
    await waitFor(() => expect(view.getByText("September 2026")).toBeTruthy());
  });

  it("calls onBack from the back action", async () => {
    const onBack = jest.fn();
    const view = renderScreen(onBack);

    await waitFor(() => expect(view.getByText("September 2026")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Back to past plans"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
