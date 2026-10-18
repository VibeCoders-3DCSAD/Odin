import type { SupabaseClient } from "@supabase/supabase-js";
import { ForecastUpstreamError, getMlForecast } from "../../../services/forecastService.js";
import { recommendPlanCategories } from "../../../services/financialPlan/mlAdapter.js";
import { getFinancialPlanRecommendation } from "../../../services/financialPlan/recommendationService.js";
import { createFinancialConditionAssessment } from "../../../services/financialConditionAssessmentService.js";
import { explainFinancialPlan } from "../../../services/financialPlan/explanationService.js";

jest.mock("../../../lib/supabase.js", () => ({ getServiceRoleClient: () => ({}) }));
jest.mock("../../../services/forecastService.js", () => ({ ...jest.requireActual("../../../services/forecastService.js"), getMlForecast: jest.fn() }));
jest.mock("../../../services/financialPlan/mlAdapter.js", () => ({ recommendPlanCategories: jest.fn() }));
jest.mock("../../../services/financialConditionAssessmentService.js", () => ({ createFinancialConditionAssessment: jest.fn() }));
jest.mock("../../../services/financialPlan/explanationService.js", () => ({ ...jest.requireActual("../../../services/financialPlan/explanationService.js"), explainFinancialPlan: jest.fn() }));

function client(paid: number, fixed: number | null = null): SupabaseClient {
  const rows: Record<string, unknown> = {
    subcategories: [{ id: "rent", category_id: "housing", label: "Rent", minimum_amount_centavos: null, fixed_amount_centavos: fixed }],
    categories: [{ id: "housing", slug: "housing_water_utilities", label: "Housing", minimum_amount_centavos: null, fixed_amount_centavos: null }],
    financial_accounts: [{ kind: "bank", current_balance_centavos: 200_000 }],
    transactions: [{ id: "past-rent", amount_centavos: 100_000, transaction_date: "2026-09-10", transaction_type: "expense", category_id: null, subcategory_id: "rent", anomaly_evaluations: [] }],
    scheduled_payments: [{ id: "monthly-rent", name: "Monthly rent", subcategory_id: "rent", amount_centavos: 30_000, frequency: "monthly", due_day_of_month: 20, due_second_day_of_month: null, due_day_of_week: null, due_month: null, starts_on: "2026-01-01", ends_on: null }],
    scheduled_payment_records: [{ scheduled_payment_id: "monthly-rent", occurrence_date: "2026-10-20", amount_centavos: paid }],
    financial_condition_assessments: null, onboarding_sessions: null, debt_strategy_preferences: null,
  };
  return { from: (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const name of ["select", "eq", "limit", "order", "gte", "lte", "not", "maybeSingle"]) builder[name] = () => builder;
    builder.then = (resolve: (value: unknown) => void) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve);
    return builder;
  } } as unknown as SupabaseClient;
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date("2026-10-15T03:00:00Z"));
  jest.mocked(createFinancialConditionAssessment).mockResolvedValue(null);
  jest.mocked(explainFinancialPlan).mockResolvedValue([]);
  jest.mocked(getMlForecast).mockRejectedValue(new ForecastUpstreamError(503, "offline"));
  jest.mocked(recommendPlanCategories).mockImplementation(async (_user, _period, _available, categories, forecast) => ({
    recommendation: { feasibility: "FEASIBLE", allocations: categories.map((category) => ({ category_id: category.id, amount: (forecast.categoryForecasts.find((point) => point.category === category.id)?.amountCentavos ?? 0) / 100 })) }, explanations: [],
  }));
});
afterEach(() => jest.useRealTimers());

it.each([0, 10_000, 30_000])("deducts the full scheduled baseline once and reserves only the remainder after %i paid", async (paid) => {
  const plan = await getFinancialPlanRecommendation("user-1", client(paid), 200_000, ["rent"]);
  expect(recommendPlanCategories).toHaveBeenCalledWith("user-1", { start: "2026-10-01", end: "2026-10-31" }, 170_000 + paid,
    [expect.objectContaining({ id: "rent", forecastCentavos: 70_000 })], expect.objectContaining({ totalAmountCentavos: 70_000 }));
  expect(plan.recommendation.allocations[0]?.allocatedAmountCentavos).toBe(70_000);
  expect(plan.inputSnapshot.obligations.reservations).toEqual(paid === 30_000 ? [] : [{ scheduledPaymentId: "monthly-rent", subcategoryId: "rent", label: "Monthly rent", amountCentavos: 30_000 - paid, dueDate: "2026-10-20" }]);
});

it("subtracts scheduled payments from an ML category forecast, including parent selections", async () => {
  jest.mocked(getMlForecast).mockResolvedValue({ status: "SUCCESS", modelVersion: "v1", forecasts: [], snapshot: { month: "2026-10", totalAmountCentavos: 120_000, categoryForecasts: [{ category: "housing_water_utilities", amountCentavos: 120_000 }], modelVersion: "v1", generatedAt: "2026-10-15T03:00:00Z", quality: "PERSONALIZED" } });
  const plan = await getFinancialPlanRecommendation("user-1", client(0), 200_000, [], ["housing"]);
  expect(getMlForecast).toHaveBeenCalled();
  expect(recommendPlanCategories).toHaveBeenCalledWith("user-1", expect.anything(), 170_000, [expect.objectContaining({ id: "housing", forecastCentavos: 90_000 })], expect.objectContaining({ totalAmountCentavos: 90_000 }));
  expect(plan.recommendation.allocations[0]?.allocatedAmountCentavos).toBe(90_000);
});

it("counts the scheduled portion toward a Fixed category instead of reserving it twice", async () => {
  // Optimizer honors the residual Fixed amount, independently of its spending forecast.
  jest.mocked(recommendPlanCategories).mockImplementation(async (_user, _period, _available, categories) => ({ recommendation: { feasibility: "FEASIBLE", allocations: categories.map((category) => ({ category_id: category.id, amount: category.floorCentavos / 100 })) } }));
  const plan = await getFinancialPlanRecommendation("user-1", client(0, 50_000), 200_000);
  expect(plan.recommendation.allocations[0]).toMatchObject({ allocationRule: "FIXED", allocatedAmountCentavos: 20_000, floorAmountCentavos: 20_000, ceilingAmountCentavos: 20_000 });
});

it("applies forecast changes to the baseline left after scheduled payments", async () => {
  jest.mocked(getMlForecast).mockResolvedValue({ status: "SUCCESS", modelVersion: "v1", forecasts: [{ category: "housing_water_utilities", month: "2026-10", quarter: "Q4", amountCentavos: 120_000, userBaselineCentavos: 100_000, hfceMultiplier: 1.2, hfceForecastAmountMillionPhp: 1, explanation: "" }], snapshot: { month: "2026-10", totalAmountCentavos: 120_000, categoryForecasts: [{ category: "housing_water_utilities", amountCentavos: 120_000 }], modelVersion: "v1", generatedAt: "2026-10-15T03:00:00Z", quality: "PERSONALIZED" } });
  const plan = await getFinancialPlanRecommendation("user-1", client(0), 200_000, ["rent"]);
  // (100,000 baseline - 30,000 scheduled) * 1.2 = 84,000 category forecast.
  expect(plan.recommendation.allocations[0]?.forecastAmountCentavos).toBe(84_000);
  expect(explainFinancialPlan).toHaveBeenCalledWith(expect.objectContaining({ forecastChanges: [expect.objectContaining({ baselineCentavos: 70_000, forecastCentavos: 84_000 })] }), expect.anything(), "user-1");
});

it("reports a shortfall using only the residual Fixed requirement plus the scheduled reservation", async () => {
  const plan = await getFinancialPlanRecommendation("user-1", client(0, 50_000), 15_000);
  expect(plan.status).toBe("INFEASIBLE");
  expect(plan.recommendation).toMatchObject({ requiredFundsCentavos: 50_000, shortfallCentavos: 35_000 });
});
