import { jest } from "@jest/globals";
import { BudgetRecommendationUpstreamError, BudgetRecommendationValidationError, getBudgetRecommendation, mapMlBudgetResponse, parseBudgetRecommendationRequest } from "../../services/budgetRecommendationService";

const request = {
  periodKind: "MONTHLY",
  periodStart: "2026-09-01",
  periodEnd: "2026-10-01",
  totalAmountMinor: 10_000,
  debtBudgetAmountMinor: 2_000,
  savingsBudgetAmountMinor: 1_000,
  allocations: [
    { categoryId: "category-1", subcategoryId: null, preferredAmountMinor: 2_000 },
    { categoryId: null, subcategoryId: "subcategory-1", preferredAmountMinor: 1_000 },
  ],
} as const;

function taxonomyClient() {
  const categoryQuery = { select: jest.fn(), in: jest.fn(), eq: jest.fn(), or: jest.fn() };
  categoryQuery.select.mockReturnValue(categoryQuery); categoryQuery.in.mockReturnValue(categoryQuery); categoryQuery.eq.mockReturnValue(categoryQuery); categoryQuery.or.mockReturnValue({ data: [{ id: "category-1" }], error: null });
  const subcategoryQuery = { select: jest.fn(), in: jest.fn(), eq: jest.fn(), or: jest.fn() };
  subcategoryQuery.select.mockReturnValue(subcategoryQuery); subcategoryQuery.in.mockReturnValue(subcategoryQuery); subcategoryQuery.eq.mockReturnValue(subcategoryQuery); subcategoryQuery.or.mockReturnValue({ data: [{ id: "subcategory-1" }], error: null });
  return { from: jest.fn((table: string) => table === "categories" ? categoryQuery : subcategoryQuery) } as never;
}

describe("budget recommendation ML adapter", () => {
  afterEach(() => { delete process.env.BUDGET_ML_BASE_URL; });

  it("validates dates, envelopes, and unique owned targets before calling ML", () => {
    expect(parseBudgetRecommendationRequest(request)).toEqual(request);
    expect(() => parseBudgetRecommendationRequest({ ...request, periodStart: "2026-02-31" })).toThrow(BudgetRecommendationValidationError);
    expect(() => parseBudgetRecommendationRequest({ ...request, debtBudgetAmountMinor: 9_000, savingsBudgetAmountMinor: 1_000 })).toThrow(BudgetRecommendationValidationError);
    expect(() => parseBudgetRecommendationRequest({ ...request, allocations: [request.allocations[0], request.allocations[0]] })).toThrow(BudgetRecommendationValidationError);
  });

  it("injects the authenticated user, derives ratios, and reconciles centavos", async () => {
    process.env.BUDGET_ML_BASE_URL = "http://ml.internal/";
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ recommendation: { allocations: [{ category_id: "category-1", amount: 46.67 }, { category_id: "subcategory-1", amount: 23.32 }] } }) });
    const result = await getBudgetRecommendation("user-1", request, taxonomyClient(), fetcher);
    expect(fetcher).toHaveBeenCalledWith("http://ml.internal/api/v1/budget/recommend", expect.anything());
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual(expect.objectContaining({ user_id: "user-1", available_funds: 70, target_ratios: { "category-1": 2 / 3, "subcategory-1": 1 / 3 } }));
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).not.toHaveProperty("transaction_history");
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).not.toHaveProperty("forecast");
    expect(result.allocations.reduce((total, allocation) => total + allocation.amountMinor, 0)).toBe(7_000);
    expect(result.allocations).toEqual(expect.arrayContaining([expect.objectContaining({ categoryId: "category-1" }), expect.objectContaining({ subcategoryId: "subcategory-1" })]));
  });

  it("forwards validated history and centavo forecast context without descriptions", async () => {
    process.env.BUDGET_ML_BASE_URL = "http://ml.internal";
    const context = {
      historicalTransactions: [{ transactionId: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be", date: "2026-09-04", amount: 245.5, category: "Essentials", transactionType: "expense", description: "private note" }],
      forecast: {
        version: 1,
        forecasts: [{ date: "2026-10-01", amountMinor: 12_345, category: "Essentials" }],
        forecastHorizon: "MONTHLY",
        forecastLevel: "CATEGORY_GROUP",
        confidenceInterval: { lower80Minor: 10_000, upper80Minor: 14_000, lower95Minor: 9_000, upper95Minor: 15_000 },
        status: "SUCCESS",
      },
    } as const;
    const parsed = parseBudgetRecommendationRequest({ ...request, ...context });
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ recommendation: { allocations: [{ category_id: "category-1", amount: 35 }, { category_id: "subcategory-1", amount: 35 }] } }) });
    await getBudgetRecommendation("user-1", parsed, taxonomyClient(), fetcher);
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual(expect.objectContaining({
      user_id: "user-1",
      transaction_history: [{ transaction_id: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be", date: "2026-09-04", amount: 245.5, category: "Essentials", transaction_type: "expense" }],
      forecast: expect.objectContaining({ forecasts: [{ date: "2026-10-01", amount: 123.45, category: "Essentials" }], confidence_interval: { lower_80: 100, upper_80: 140, lower_95: 90, upper_95: 150 } }),
    }));
  });

  it("rejects malformed or oversized optional context before ML is called", () => {
    expect(() => parseBudgetRecommendationRequest({ ...request, historicalTransactions: Array.from({ length: 501 }, () => ({ transactionId: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be", date: "2026-09-04", amount: 1, category: "Other", transactionType: "expense" })) })).toThrow(BudgetRecommendationValidationError);
    expect(() => parseBudgetRecommendationRequest({ ...request, historicalTransactions: [{ transactionId: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be", date: "2026-09-04", amount: 0.001, category: "Other", transactionType: "expense" }] })).toThrow(BudgetRecommendationValidationError);
    expect(() => parseBudgetRecommendationRequest({ ...request, forecast: { version: 1, forecasts: [], forecastHorizon: "MONTHLY", forecastLevel: "CATEGORY_GROUP", confidenceInterval: { lower80Minor: -1, upper80Minor: 1, lower95Minor: 1, upper95Minor: 1 }, status: "SUCCESS" } })).toThrow(BudgetRecommendationValidationError);
  });

  it("uses equal target ratios when every preference is zero", async () => {
    process.env.BUDGET_ML_BASE_URL = "http://ml.internal";
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ recommendation: { allocations: [{ category_id: "category-1", amount: 35 }, { category_id: "subcategory-1", amount: 35 }] } }) });
    const result = await getBudgetRecommendation("user-1", { ...request, allocations: request.allocations.map((target) => ({ ...target, preferredAmountMinor: 0 })) }, taxonomyClient(), fetcher);
    expect(JSON.parse(fetcher.mock.calls[0]![1].body).target_ratios).toEqual({ "category-1": 0.5, "subcategory-1": 0.5 });
    expect(result.allocations.map((allocation) => allocation.amountMinor)).toEqual([3_500, 3_500]);
  });

  it("rejects malformed, unknown, duplicate, and negative ML allocation responses", () => {
    const invalid = (allocations: unknown[]) => () => mapMlBudgetResponse({ recommendation: { allocations } }, request, 7_000);
    expect(invalid([{ category_id: "unknown", amount: 1 }, { category_id: "subcategory-1", amount: 69 }])).toThrow(BudgetRecommendationUpstreamError);
    expect(invalid([{ category_id: "category-1", amount: 1 }, { category_id: "category-1", amount: 69 }])).toThrow(BudgetRecommendationUpstreamError);
    expect(invalid([{ category_id: "category-1", amount: -1 }, { category_id: "subcategory-1", amount: 71 }])).toThrow(BudgetRecommendationUpstreamError);
  });
});
