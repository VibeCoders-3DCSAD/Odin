import type { SupabaseClient } from "@supabase/supabase-js";

jest.mock("../../../services/forecastService.js", () => ({
  ...jest.requireActual("../../../services/forecastService.js"),
  getMlForecast: jest.fn(),
}));
jest.mock("../../../services/financialPlan/mlAdapter.js", () => ({ recommendPlanCategories: jest.fn() }));
jest.mock("../../../services/financialConditionAssessmentService.js", () => ({ createFinancialConditionAssessment: jest.fn() }));
jest.mock("../../../lib/supabase.js", () => ({ getServiceRoleClient: jest.fn() }));

import { getMlForecast } from "../../../services/forecastService.js";
import { createFinancialConditionAssessment } from "../../../services/financialConditionAssessmentService.js";
import { recommendPlanCategories } from "../../../services/financialPlan/mlAdapter.js";
import { getFinancialPlanRecommendation } from "../../../services/financialPlan/recommendationService.js";

describe("Financial Plan recommendations with recorded spending", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-18T00:00:00Z"));
    (createFinancialConditionAssessment as jest.Mock).mockResolvedValue(null);
    (getMlForecast as jest.Mock).mockResolvedValue({
      snapshot: { month: "2026-10", categoryForecasts: [{ category: "communication", amountCentavos: 168_000 }], modelVersion: "test", generatedAt: "2026-10-18T00:00:00Z", quality: "SUCCESS" },
      forecasts: [],
    });
    (recommendPlanCategories as jest.Mock).mockResolvedValue({ recommendation: { feasibility: "FEASIBLE", allocations: [{ category_id: "internet", amount: 1680 }] } });
  });

  afterEach(() => jest.useRealTimers());

  function client(spentCentavos: number, minimum: number | null = null, additionalRows: Record<string, unknown[]> = {}) {
    const rows: Record<string, unknown[]> = {
      subcategories: [{ id: "internet", category_id: "communication", label: "Home Internet", minimum_amount_centavos: minimum, fixed_amount_centavos: null }],
      categories: [{ id: "communication", slug: "communication", label: "Communication", minimum_amount_centavos: null, fixed_amount_centavos: null }],
      financial_accounts: [{ kind: "cash", current_balance_centavos: 1_000_000 }],
      transactions: [{ id: "payment", amount_centavos: spentCentavos, transaction_date: "2026-10-10", transaction_type: "expense", category_id: "communication", subcategory_id: "internet", anomaly_evaluations: [] }],
      ...additionalRows,
    };
    return { from: (table: string) => {
      const result = { data: rows[table] ?? [], error: null };
      const query: unknown = new Proxy({}, { get: (_, key) => key === "maybeSingle" ? () => Promise.resolve({ data: rows[table]?.[0] ?? null, error: null }) : key === "then" ? Promise.resolve(result).then.bind(Promise.resolve(result)) : () => query });
      return query;
    } } as SupabaseClient;
  }

  it.each([50_000, 171_701])("keeps the monthly forecast and optimizer allocation when spending is %i centavos", async (spent) => {
    const result = await getFinancialPlanRecommendation("user", client(spent), 500_000, ["internet"]);
    expect(recommendPlanCategories).toHaveBeenCalledWith("user", result.period, 500_000,
      [expect.objectContaining({ id: "internet", forecastCentavos: 168_000 })],
      expect.objectContaining({ categoryForecasts: [{ category: "internet", amountCentavos: 168_000 }] }));
    expect(result.recommendation.availableFundsCentavos).toBe(500_000);
    expect(result.recommendation.allocations[0]).toMatchObject({ allocatedAmountCentavos: 168_000, forecastAmountCentavos: 168_000 });
  });

  it("preserves fractional centavos from the LP without rounding or redistributing them", async () => {
    const subcategories = ["internet", "mobile", "postage"].map((id) => ({ id, category_id: "communication", label: id, minimum_amount_centavos: null, fixed_amount_centavos: null }));
    (recommendPlanCategories as jest.Mock).mockResolvedValue({ recommendation: { feasibility: "FEASIBLE", allocations: subcategories.map(({ id }) => ({ category_id: id, amount: 1.006 })) } });
    (getMlForecast as jest.Mock).mockResolvedValue({
      snapshot: { month: "2026-10", categoryForecasts: [{ category: "communication", amountCentavos: 301.23456789 }], modelVersion: "test", generatedAt: "2026-10-18T00:00:00Z", quality: "PERSONALIZED" },
      forecasts: [],
    });
    const transactions = subcategories.map(({ id }) => ({ id: `past-${id}`, amount_centavos: 50_000, transaction_date: "2026-10-10", transaction_type: "expense", category_id: "communication", subcategory_id: id, anomaly_evaluations: [] }));
    const result = await getFinancialPlanRecommendation("user", client(50_000, null, { subcategories, transactions }), 302, subcategories.map(({ id }) => id));

    const allocated = result.recommendation.allocations.map((allocation) => allocation.allocatedAmountCentavos);
    expect(allocated).toEqual([100.6, 100.6, 100.6]);
    const optimizerCategories = (recommendPlanCategories as jest.Mock).mock.calls[0][3];
    expect(optimizerCategories.map((category: { forecastCentavos: number }) => category.forecastCentavos)).toEqual(Array(3).fill(301.23456789 * 50_000 / 150_000));
    expect(302 - allocated.reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(0.2);
  });

  it("does not apply a Christmas expense pattern to Communication or change the recommendation", async () => {
    (getMlForecast as jest.Mock).mockResolvedValue({
      snapshot: { month: "2026-10", categoryForecasts: [{ category: "communication", amountCentavos: 168_000 }], modelVersion: "test", generatedAt: "2026-10-18T00:00:00Z", quality: "PERSONALIZED" },
      forecasts: [{ category: "communication", month: "2026-10", amountCentavos: 168_000, userBaselineCentavos: 140_000, explanation: "" }],
    });
    const result = await getFinancialPlanRecommendation("user", client(50_000, null, {
      onboarding_sessions: [{ raw_answers: { high_expense_seasons: ["summer"], low_expense_seasons: ["christmas_ber_months"] } }],
    }), 500_000, ["internet"]);

    expect(result.explanationRequest.evidence.seasonalPreferences).toEqual([
      expect.objectContaining({ season: "Christmas and Ber Months", preference: "lower_expense" }),
    ]);
    expect(result.explanations[0]).toContain("No specific reason identified.");
    expect(result.explanations[0]).not.toContain("Christmas");
    expect(result.recommendation.allocations[0]).toMatchObject({ allocatedAmountCentavos: 168_000, forecastAmountCentavos: 168_000 });
    expect(recommendPlanCategories).toHaveBeenCalledWith("user", result.period, 500_000,
      [expect.objectContaining({ forecastCentavos: 168_000 })], expect.any(Object));
  });

  it("keeps configured minimums and available funds unchanged on the infeasible path", async () => {
    const result = await getFinancialPlanRecommendation("user", client(171_701, 200_000), 100_000, ["internet"]);
    expect(result.status).toBe("INFEASIBLE");
    expect(result.recommendation.availableFundsCentavos).toBe(100_000);
    expect(result.recommendation.allocations[0]).toMatchObject({ allocatedAmountCentavos: 200_000, floorAmountCentavos: 200_000 });
    expect(recommendPlanCategories).not.toHaveBeenCalled();
  });

  it("includes confirmed payment reservations as separate explanation evidence without adding them to the category budget", async () => {
    (getMlForecast as jest.Mock).mockResolvedValue({
      snapshot: { month: "2026-10", categoryForecasts: [{ category: "communication", amountCentavos: 168_000 }], modelVersion: "test", generatedAt: "2026-10-18T00:00:00Z", quality: "PERSONALIZED" },
      forecasts: [{ category: "communication", month: "2026-10", amountCentavos: 168_000, userBaselineCentavos: 140_000, explanation: "" }],
    });
    (recommendPlanCategories as jest.Mock).mockResolvedValue({ recommendation: { feasibility: "FEASIBLE", allocations: [{ category_id: "internet", amount: 800 }] } });
    const result = await getFinancialPlanRecommendation("user", client(50_000, null, {
      scheduled_payments: [{ id: "internet-bill", subcategory_id: "internet", amount_centavos: 20_000, frequency: "once", starts_on: "2026-10-22", ends_on: null }],
    }), 500_000, ["internet"]);

    expect(result.explanationRequest.evidence).toMatchObject({
      planMonth: "2026-10", forecastComparisonBasis: "usual_category_spending",
      confirmedExpenses: [{ scheduledPaymentId: "internet-bill", categorySlug: "communication", dueDate: "2026-10-22", amountCentavos: 20_000 }],
      financialConstraints: { plannedAmountCentavos: 500_000, categoryBudgetCentavos: 480_000, scheduledPaymentsCentavos: 20_000 },
    });
    expect(result.recommendation.allocations[0]).toMatchObject({ allocatedAmountCentavos: 80_000, forecastAmountCentavos: 144_000 });
    expect(result.explanations.join(" ")).toContain("Separately, ₱200 is reserved for recorded payments in this category.");
    expect(result.explanations[0]).toContain("A lower budget does not mean lower expected expenses");
    expect(recommendPlanCategories).toHaveBeenCalledWith("user", result.period, 480_000, expect.any(Array), expect.any(Object));
    expect(result.inputSnapshot.spendingExplanationEvidence).toMatchObject({ forecastComparisonBasis: "usual_category_spending" });
  });

  it("does not recommend a zero category budget for a separately reserved biller", async () => {
    (recommendPlanCategories as jest.Mock).mockResolvedValue({ recommendation: { feasibility: "FEASIBLE", allocations: [{ category_id: "internet", amount: 0 }] } });
    const result = await getFinancialPlanRecommendation("user", client(0, null, {
      transactions: [],
      scheduled_payments: [{ id: "internet-bill", name: "Home Internet", subcategory_id: "internet", amount_centavos: 20_000, frequency: "once", starts_on: "2026-10-22", ends_on: null }],
    }), 500_000, ["internet"]);

    expect(result.recommendation.allocations[0]).toMatchObject({ allocatedAmountCentavos: 0, forecastAmountCentavos: 0, floorAmountCentavos: 0 });
    expect(result.inputSnapshot.obligations.reservations).toEqual([
      expect.objectContaining({ scheduledPaymentId: "internet-bill", amountCentavos: 20_000 }),
    ]);
    expect(result.explanationRequest.leading).toEqual([]);
    expect(result.explanations.join(" ")).not.toContain("Home Internet");
  });

  it("does not explain an unselected category as receiving an insufficient zero budget", async () => {
    (getMlForecast as jest.Mock).mockResolvedValue({
      snapshot: { month: "2026-10", categoryForecasts: [{ category: "communication", amountCentavos: 168_000 }, { category: "education", amountCentavos: 500_000 }], modelVersion: "test", generatedAt: "2026-10-18T00:00:00Z", quality: "PERSONALIZED" },
      forecasts: [
        { category: "communication", month: "2026-10", amountCentavos: 168_000, userBaselineCentavos: 140_000, explanation: "" },
        { category: "education", month: "2026-10", amountCentavos: 500_000, userBaselineCentavos: 100_000, explanation: "" },
      ],
    });
    const result = await getFinancialPlanRecommendation("user", client(50_000, null, {
      categories: [
        { id: "communication", slug: "communication", label: "Communication", minimum_amount_centavos: null, fixed_amount_centavos: null },
        { id: "education", slug: "education", label: "Education", minimum_amount_centavos: null, fixed_amount_centavos: null },
      ],
    }), 500_000, ["internet"]);
    expect(result.explanationRequest.evidence.forecastChanges.map((item) => item.categorySlug)).toEqual(["communication"]);
    expect(result.explanations.join(" ")).not.toMatch(/Education|budgets below estimated spending/);
  });

  it("uses November for the forecast and includes November loan payments and savings contributions", async () => {
    const novemberClient = client(171_701, null, {
      financial_accounts: [{ kind: "cash", current_balance_centavos: 5_000_000 }],
      debt_accounts: [
        { id: "personal", current_balance_centavos: 7_850_000, minimum_payment_centavos: 450_000, payment_frequency: "monthly", payment_schedule: {}, next_due_date: "2026-11-05" },
        { id: "motorcycle", current_balance_centavos: 14_200_000, minimum_payment_centavos: 680_000, payment_frequency: "monthly", payment_schedule: {}, next_due_date: "2026-11-20" },
      ],
      savings_goals: [
        { id: "emergency", planned_contribution_amount_centavos: 500_000, contribution_frequency: "monthly", contribution_interval_count: 1, contribution_day_of_month: 16, next_contribution_date: "2026-11-16" },
        { id: "laptop", planned_contribution_amount_centavos: 300_000, contribution_frequency: "monthly", contribution_interval_count: 1, contribution_day_of_month: 16, next_contribution_date: "2026-11-16" },
      ],
    });
    // The forecast fallback must also cover November if the model returns a different month.
    const result = await getFinancialPlanRecommendation("user", novemberClient, 5_000_000, ["internet"], [], [], {}, "2026-11");
    expect(result.period).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(getMlForecast).toHaveBeenCalledWith("user", expect.objectContaining({ targetMonth: "2026-11" }));
    expect(recommendPlanCategories).toHaveBeenCalledWith("user", result.period, 3_070_000, expect.any(Array), expect.objectContaining({ month: "2026-11" }));
    expect(result.recommendation.debtReservations).toEqual([
      { debtAccountId: "personal", creditCardStatementId: null, amountCentavos: 450_000, dueDate: "2026-11-05" },
      { debtAccountId: "motorcycle", creditCardStatementId: null, amountCentavos: 680_000, dueDate: "2026-11-20" },
    ]);
    expect(result.recommendation.savingsReservations).toEqual([
      { savingsGoalId: "emergency", amountCentavos: 500_000, dueDate: "2026-11-16" },
      { savingsGoalId: "laptop", amountCentavos: 300_000, dueDate: "2026-11-16" },
    ]);
  });
});
