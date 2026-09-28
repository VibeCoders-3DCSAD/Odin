jest.mock("../../../lib/api", () => ({ API_BASE_URL: "http://api.test", REQUEST_TIMEOUT_MS: 10_000 }));

import { requestBudgetRecommendation, toBudgetRecommendationForecast, type BudgetRecommendationRequest } from "../api";

const request: BudgetRecommendationRequest = {
  periodKind: "MONTHLY",
  periodStart: "2026-09-01",
  periodEnd: "2026-10-01",
  totalAmountMinor: 10_000,
  debtBudgetAmountMinor: 2_000,
  savingsBudgetAmountMinor: 1_000,
  allocations: [{ categoryId: "category-1", subcategoryId: null, preferredAmountMinor: 7_000 }],
};

describe("budget recommendation API", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the authenticated Odin API with the form's centavo request", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ payload: { availableFundsMinor: 7_000, debtBudgetAmountMinor: 2_000, savingsBudgetAmountMinor: 1_000, allocations: [] } }), { status: 200 }));
    const result = await requestBudgetRecommendation("access-token", request);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringMatching(/\/odin\/api\/budget\/recommendations$/), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer access-token" }), body: JSON.stringify(request) }));
    expect(result.body.payload?.availableFundsMinor).toBe(7_000);
  });

  it("honors cancellation without exposing an ML endpoint", async () => {
    const controller = new AbortController();
    controller.abort();
    jest.spyOn(global, "fetch").mockRejectedValue(new DOMException("aborted", "AbortError"));
    await expect(requestBudgetRecommendation("access-token", request, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not treat quarterly HFCE projections as monthly budget context", () => {
    expect(toBudgetRecommendationForecast({ forecasts: [{ category: "food", month: "2026-10", quarter: "2026Q4", amountCentavos: 12_345, userBaselineCentavos: 10_000, hfceMultiplier: 1.2, hfceForecastAmountMillionPhp: 1234, explanation: "Personalized food forecast." }], modelVersion: "hfce-sarima-v4-category-quarterly", status: "SUCCESS" })).toBeNull();
  });
});
