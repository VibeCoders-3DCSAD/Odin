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

  it("aggregates posted expenses for each allocation within the plan period", async () => {
    const db = { getAllAsync: jest.fn(async () => [
      { category_id: "food", subcategory_id: null, spent_amount_centavos: 4_500 },
      { category_id: null, subcategory_id: "transport", spent_amount_centavos: 1_250 },
    ]) };
    mockInitDatabase.mockResolvedValue(db);

    const { getFinancialPlanAllocationSpending } = await import("../financialPlans");
    await expect(getFinancialPlanAllocationSpending("user-1", "plan-1")).resolves.toEqual({
      "category:food": 4_500,
      "subcategory:transport": 1_250,
    });

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("t.transaction_date >= p.period_start AND t.transaction_date <= p.period_end"),
      "user-1",
      "plan-1",
    );
  });

  it("totals only posted expense transactions in the accepted plan period", async () => {
    const db = { getFirstAsync: jest.fn(async () => ({ spent_amount_centavos: 12_345 })) };
    mockInitDatabase.mockResolvedValue(db);

    const { getFinancialPlanSpentAmount } = await import("../financialPlans");
    await expect(getFinancialPlanSpentAmount("user-1", "plan-1")).resolves.toBe(12_345);

    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("t.transaction_date >= p.period_start AND t.transaction_date <= p.period_end"),
      "user-1",
      "plan-1",
    );
  });

  it("resolves plan references to owned display names in bounded queries", async () => {
    const db = {
      getAllAsync: jest.fn()
        .mockResolvedValueOnce([{ id: "category-1", label: "Household" }])
        .mockResolvedValueOnce([{ id: "subcategory-1", label: "Groceries" }])
        .mockResolvedValueOnce([{ id: "debt-1", name: "Car loan" }])
        .mockResolvedValueOnce([{ id: "goal-1", name: "Emergency fund" }])
        .mockResolvedValueOnce([{ id: "statement-1", name: "Visa" }]),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { getFinancialPlanLabels } = await import("../financialPlans");
    await expect(getFinancialPlanLabels("user-1", {
      recommendation: {
        allocations: [{ categoryId: "category-1" }, { subcategoryId: "subcategory-1" }],
        debtReservations: [{ debtAccountId: "debt-1" }, { creditCardStatementId: "statement-1" }],
        savingsReservations: [{ savingsGoalId: "goal-1" }],
      },
    })).resolves.toEqual({
      categories: { "category-1": "Household" }, subcategories: { "subcategory-1": "Groceries" }, debtAccounts: { "debt-1": "Car loan" }, savingsGoals: { "goal-1": "Emergency fund" }, creditCardStatements: { "statement-1": "Visa statement" },
    });
    expect(db.getAllAsync).toHaveBeenCalledTimes(5);
    for (const call of db.getAllAsync.mock.calls) expect(call.slice(1)).toContain("user-1");
  });
});
