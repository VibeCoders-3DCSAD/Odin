jest.mock("../../../lib/api", () => ({ API_BASE_URL: "http://localhost:3001", REQUEST_TIMEOUT_MS: 10_000 }));

import { requestFinancialPlanRecommendation } from "../api";

describe("Financial Plan development month request", () => {
  const originalDevelopment = __DEV__;
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ json: async () => ({}) });
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, "__DEV__", { value: originalDevelopment, writable: true, configurable: true });
  });

  it.each([true, false])("sends a selected month only when development is %p", async (development) => {
    Object.defineProperty(globalThis, "__DEV__", { value: development, writable: true, configurable: true });
    await requestFinancialPlanRecommendation("token", [], [], 100_000, [], { debtRepayments: false, savingsContributions: false }, undefined, "2026-11");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    if (development) expect(body.planMonth).toBe("2026-11");
    else expect(body).not.toHaveProperty("planMonth");
  });
});
