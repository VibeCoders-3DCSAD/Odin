import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
const mockEnqueueOperation = jest.fn<(...args: any[]) => any>();

jest.mock("../../client", () => ({
  initDatabase: (...args: any[]) => mockInitDatabase(...args),
}));

jest.mock("../../helpers", () => {
  const actual = jest.requireActual("../../helpers") as Record<string, unknown>;
  return { ...actual, enqueueOperation: (...args: any[]) => mockEnqueueOperation(...args) };
});

jest.mock("../../uuid", () => ({ randomUUID: () => "plan-1" }));

describe("financial plan repository", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset();
  });

  it("loads only the latest accepted plan for the current user", async () => {
    const row = {
      id: "plan-1", period_start: "2026-10-01", period_end: "2026-10-31", status: "accepted",
      forecast_month: "2026-10", forecast_total_centavos: 0, forecast_model_version: "v1", forecast_generated_at: "2026-09-01T00:00:00.000Z", forecast_quality: "FALLBACK",
      classification_status: null, classification_rule_set_version: null, classification_assessed_at: null,
      available_funds_centavos: 0, required_funds_centavos: null, shortfall_centavos: null,
    };
    const db = { getFirstAsync: jest.fn(async () => row), getAllAsync: jest.fn(async () => []) };
    mockInitDatabase.mockResolvedValue(db);

    const { getLatestFinancialPlan } = await import("../financialPlans");
    await expect(getLatestFinancialPlan("user-1")).resolves.toEqual({
      id: "plan-1", periodStart: "2026-10-01", periodEnd: "2026-10-31",
      inputSnapshot: { forecast: { month: "2026-10", totalAmountCentavos: 0, modelVersion: "v1", generatedAt: "2026-09-01T00:00:00.000Z", quality: "FALLBACK", categoryForecasts: [] }, restrictions: { allocations: [] }, obligations: { reservations: [] }, debtRequirements: { reservations: [] }, savingsRequirements: { reservations: [] }, classification: { status: null, rule_set_version: null, assessed_at: null } }, recommendation: { availableFundsCentavos: 0, requiredFundsCentavos: null, shortfallCentavos: null, allocations: [], debtReservations: [], savingsReservations: [] },
    });
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = ? AND status = 'accepted' AND deleted = 0"),
      "user-1",
    );
  });

  it("loads an accepted plan only for the requested user and period", async () => {
    const db = { getFirstAsync: jest.fn(async () => null), getAllAsync: jest.fn(async () => []) };
    mockInitDatabase.mockResolvedValue(db);

    const { getAcceptedFinancialPlanForPeriod } = await import("../financialPlans");
    await expect(getAcceptedFinancialPlanForPeriod("user-1", "2026-10-01", "2026-10-31")).resolves.toBeNull();

    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = ? AND period_start = ? AND period_end = ? AND status = 'accepted' AND deleted = 0"),
      "user-1",
      "2026-10-01",
      "2026-10-31",
    );
  });
});
