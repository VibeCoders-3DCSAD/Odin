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
const mockGetPlanSpendingReview = jest.fn<(...args: any[]) => any>();
jest.mock("../financialPlanSpendingReview", () => ({ getPlanSpendingReview: (...args: any[]) => mockGetPlanSpendingReview(...args) }));

describe("financial plan repository", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset();
    mockGetPlanSpendingReview.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it("accepts a current-month plan created mid-month with the numeric planned amount in its input snapshot", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-15T03:00:00.000Z"));
    const db = {
      withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
      getAllAsync: jest.fn(async () => []),
      runAsync: jest.fn(async () => ({})),
    };
    mockInitDatabase.mockResolvedValue(db);
    mockEnqueueOperation.mockResolvedValue({ id: "operation-1" });

    const { createFinancialPlan } = await import("../financialPlans");
    const input = {
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      inputSnapshot: {
        plannedAmountCentavos: 100_000,
        forecast: { month: "2026-10", totalAmountCentavos: 0, modelVersion: "v1", generatedAt: "2026-10-01T00:00:00.000Z", quality: "FALLBACK", categoryForecasts: [] },
        restrictions: { allocations: [] },
        obligations: { reservations: [] },
        debtRequirements: { reservations: [] },
        savingsRequirements: { reservations: [] },
        classification: { status: "unavailable" },
      },
      recommendation: { availableFundsCentavos: 100_000 },
      allocations: [],
      debtReservations: [],
      savingsReservations: [],
    };

    await expect(createFinancialPlan("user-1", "device-1", input)).resolves.toEqual(expect.objectContaining({ id: "plan-1" }));
    expect(db.runAsync).toHaveBeenCalled();
    await expect(createFinancialPlan("user-1", "device-1", { ...input, periodStart: "2026-11-01", periodEnd: "2026-11-30" })).rejects.toThrow("Financial Plans can only cover the current calendar month");
    await expect(createFinancialPlan("user-1", "device-1", { ...input, periodStart: "2026-09-01", periodEnd: "2026-09-30" })).rejects.toThrow("Financial Plans can only cover the current calendar month");
  });

  it("saves fractional-centavo recommendations without rounding", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-15T03:00:00.000Z"));
    const db = {
      withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
      getAllAsync: jest.fn(async () => [{ id: "subcategory-1", category_id: null }]),
      runAsync: jest.fn(async () => ({})),
    };
    mockInitDatabase.mockResolvedValue(db);
    mockEnqueueOperation.mockResolvedValue({ id: "operation-1" });
    const { createFinancialPlan } = await import("../financialPlans");
    const allocation = { subcategoryId: "subcategory-1", allocationRule: "FLEXIBLE" as const, allocatedAmountCentavos: 100.6, floorAmountCentavos: 0, forecastAmountCentavos: 123.456 };
    await createFinancialPlan("user-1", "device-1", {
      periodStart: "2026-10-01", periodEnd: "2026-10-31",
      inputSnapshot: {
        plannedAmountCentavos: 302,
        forecast: { month: "2026-10", totalAmountCentavos: 123.456, modelVersion: "v1", generatedAt: "2026-10-01T00:00:00.000Z", quality: "FALLBACK", categoryForecasts: [{ category: "subcategory-1", amountCentavos: 123.456 }] },
        restrictions: { allocations: [] }, obligations: { reservations: [] }, debtRequirements: { reservations: [] }, savingsRequirements: { reservations: [] }, classification: { status: "unavailable" },
      },
      recommendation: { availableFundsCentavos: 302 }, allocations: [allocation], debtReservations: [], savingsReservations: [],
    });
    expect(mockEnqueueOperation).toHaveBeenCalledWith(db, expect.objectContaining({ payload: expect.objectContaining({ recommendation: expect.objectContaining({ allocations: [allocation] }) }) }));
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO financial_plan_forecast_points"), "plan-1", "subcategory-1", 123.456);
  });

  it("covers the whole calendar month containing the reference date", async () => {
    const { getCurrentFinancialPlanPeriod } = await import("../financialPlans");
    expect(getCurrentFinancialPlanPeriod("2026-10-15")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(getCurrentFinancialPlanPeriod("2026-10-01")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(getCurrentFinancialPlanPeriod("2028-02-29")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(getCurrentFinancialPlanPeriod("2026-12-31")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
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

  it("reports allocation progress from the past-plan spending rules", async () => {
    mockGetPlanSpendingReview.mockResolvedValue({ rows: [
      { allocationId: "a1", categoryId: "food", subcategoryId: null, actualCentavos: 4_500 },
      { allocationId: "a2", categoryId: null, subcategoryId: "transport", actualCentavos: 1_250 },
    ], actualTotalCentavos: 9_000 });

    const { getFinancialPlanSpending } = await import("../financialPlans");
    await expect(getFinancialPlanSpending("user-1", "plan-1")).resolves.toEqual({ allocationSpending: { "category:food": 4_500, "subcategory:transport": 1_250 }, spentCentavos: 9_000 });
    expect(mockGetPlanSpendingReview).toHaveBeenCalledTimes(1);
    expect(mockGetPlanSpendingReview).toHaveBeenCalledWith("user-1", "plan-1");
  });

  it("reports no progress for a plan that is not accessible", async () => {
    mockGetPlanSpendingReview.mockResolvedValue(null);

    const { getFinancialPlanSpending } = await import("../financialPlans");
    await expect(getFinancialPlanSpending("user-2", "plan-1")).resolves.toEqual({ allocationSpending: {}, spentCentavos: 0 });
  });

  it("reports budget remaining as available plan funds minus recorded spending", async () => {
    mockGetPlanSpendingReview.mockResolvedValue({ rows: [], actualTotalCentavos: 1_250_000 });

    const { getFinancialPlanBudgetRemaining } = await import("../financialPlans");
    const plan = { id: "plan-1", periodStart: "2026-10-01", periodEnd: "2026-10-31", inputSnapshot: {}, recommendation: { availableFundsCentavos: 5_000_000 } };
    await expect(getFinancialPlanBudgetRemaining("user-1", plan)).resolves.toBe(3_750_000);
    expect(mockGetPlanSpendingReview).toHaveBeenCalledWith("user-1", "plan-1");
  });

  it("reports no budget remaining when the plan has no available funds", async () => {
    const { getFinancialPlanBudgetRemaining } = await import("../financialPlans");
    await expect(getFinancialPlanBudgetRemaining("user-1", { id: "plan-1", periodStart: "2026-10-01", periodEnd: "2026-10-31", inputSnapshot: {}, recommendation: {} })).resolves.toBeNull();
    expect(mockGetPlanSpendingReview).not.toHaveBeenCalled();
  });

  it("resolves plan references to owned display names in bounded queries", async () => {
    const db = {
      getAllAsync: jest.fn<(...args: any[]) => any>()
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
      categories: { "category-1": "Household" }, subcategories: { "subcategory-1": "Groceries" }, debtAccounts: { "debt-1": "Car loan" }, savingsGoals: { "goal-1": "Emergency fund" }, creditCardStatements: { "statement-1": "Visa statement" }, creditCards: {},
    });
    expect(db.getAllAsync).toHaveBeenCalledTimes(5);
    for (const call of db.getAllAsync.mock.calls) expect(call.slice(1)).toContain("user-1");
    for (const call of db.getAllAsync.mock.calls) expect(call[0]).toMatch(/deleted = 0/);
    expect(db.getAllAsync.mock.calls[4]![0]).toContain("s.deleted = 0 AND c.deleted = 0 AND a.deleted = 0");
  });

  it("resolves soft-deleted references and reports them as removed when includeDeleted is set", async () => {
    const db = {
      getAllAsync: jest.fn<(...args: any[]) => Promise<any>>()
        .mockResolvedValueOnce([{ id: "category-1", label: "Household", deleted: 1 }])
        .mockResolvedValueOnce([{ id: "subcategory-1", label: "Groceries", deleted: 0 }])
        .mockResolvedValueOnce([{ id: "debt-1", name: "Car loan", deleted: 1 }])
        .mockResolvedValueOnce([{ id: "goal-1", name: "Emergency fund", deleted: 0 }])
        .mockResolvedValueOnce([{ id: "statement-1", name: "Visa", deleted: 1 }]),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { getFinancialPlanLabels } = await import("../financialPlans");
    await expect(getFinancialPlanLabels("user-1", {
      recommendation: {
        allocations: [{ categoryId: "category-1" }, { subcategoryId: "subcategory-1" }],
        debtReservations: [{ debtAccountId: "debt-1" }, { creditCardStatementId: "statement-1" }],
        savingsReservations: [{ savingsGoalId: "goal-1" }],
      },
    }, { includeDeleted: true })).resolves.toStrictEqual({
      categories: { "category-1": "Household" }, subcategories: { "subcategory-1": "Groceries" }, debtAccounts: { "debt-1": "Car loan" }, savingsGoals: { "goal-1": "Emergency fund" }, creditCardStatements: { "statement-1": "Visa statement" }, creditCards: {},
      removedIds: ["category-1", "debt-1", "statement-1"],
    });
    expect(db.getAllAsync).toHaveBeenCalledTimes(5);
    for (const call of db.getAllAsync.mock.calls) {
      expect(call[0]).toContain("user_id = ?");
      expect(call[0]).not.toMatch(/deleted = 0/);
      expect(call.slice(1)).toContain("user-1");
    }
    expect(db.getAllAsync.mock.calls[4]![0]).toContain("MAX(s.deleted, c.deleted, a.deleted) AS deleted");
  });

  it("omits removedIds when includeDeleted is not set", async () => {
    const db = { getAllAsync: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValueOnce([{ id: "category-1", label: "Household", deleted: 0 }]) };
    mockInitDatabase.mockResolvedValue(db);

    const { getFinancialPlanLabels } = await import("../financialPlans");
    const labels = await getFinancialPlanLabels("user-1", { recommendation: { allocations: [{ categoryId: "category-1" }] } }, { includeDeleted: false });
    expect(labels).toStrictEqual({ categories: { "category-1": "Household" }, subcategories: {}, debtAccounts: {}, savingsGoals: {}, creditCardStatements: {}, creditCards: {} });
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining("WHERE user_id = ? AND deleted = 0 AND id IN"), "user-1", "category-1");
  });

  describe("listCompletedFinancialPlans", () => {
    it("lists the user's accepted, non-deleted completed plans newest first with summed planned totals in one query", async () => {
      const db = { getAllAsync: jest.fn(async () => [
        { id: "plan-sep", period_start: "2026-09-01", period_end: "2026-09-30", available_funds_centavos: 50_000, shortfall_centavos: null, planned_total_centavos: 42_500 },
        { id: "plan-aug", period_start: "2026-08-01", period_end: "2026-08-31", available_funds_centavos: 40_000, shortfall_centavos: 1_000, planned_total_centavos: 0 },
      ]) };
      mockInitDatabase.mockResolvedValue(db);

      const { listCompletedFinancialPlans } = await import("../financialPlans");
      await expect(listCompletedFinancialPlans("user-1", "2026-10-15")).resolves.toEqual([
        { id: "plan-sep", periodStart: "2026-09-01", periodEnd: "2026-09-30", availableFundsCentavos: 50_000, shortfallCentavos: null, plannedTotalCentavos: 42_500 },
        { id: "plan-aug", periodStart: "2026-08-01", periodEnd: "2026-08-31", availableFundsCentavos: 40_000, shortfallCentavos: 1_000, plannedTotalCentavos: 0 },
      ]);

      expect(db.getAllAsync).toHaveBeenCalledTimes(1);
      const [sql, ...params] = db.getAllAsync.mock.calls[0] as unknown as [string, ...unknown[]];
      expect(params).toEqual(["user-1", "2026-10-15"]);
      expect(sql).toContain("p.user_id = ?");
      expect(sql).toContain("p.status = 'accepted'");
      expect(sql).toContain("p.deleted = 0");
      expect(sql).toContain("p.period_end < ?");
      expect(sql).toContain("COALESCE(SUM(a.allocated_amount_centavos), 0) AS planned_total_centavos");
      expect(sql).toContain("LEFT JOIN financial_plan_allocations a ON a.plan_id = p.id");
      expect(sql).toContain("GROUP BY p.id");
      expect(sql).toContain("ORDER BY p.period_start DESC");
    });

    it("excludes the current-month plan because its period has not ended", async () => {
      const db = { getAllAsync: jest.fn<(...args: any[]) => Promise<any>>(async () => []) };
      mockInitDatabase.mockResolvedValue(db);

      const { listCompletedFinancialPlans } = await import("../financialPlans");
      await expect(listCompletedFinancialPlans("user-1", "2026-10-31")).resolves.toEqual([]);
      // period_end is strictly less than today, so a plan ending 2026-10-31 is not listed on 2026-10-31.
      expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringMatching(/p\.period_end < \?/), "user-1", "2026-10-31");
      expect(db.getAllAsync.mock.calls[0]![0]).not.toMatch(/period_end <= \?/);
    });

    it("rejects an invalid today date without querying", async () => {
      const db = { getAllAsync: jest.fn<(...args: any[]) => Promise<any>>(async () => []) };
      mockInitDatabase.mockResolvedValue(db);

      const { listCompletedFinancialPlans } = await import("../financialPlans");
      await expect(listCompletedFinancialPlans("user-1", "2026-13-01")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(db.getAllAsync).not.toHaveBeenCalled();
    });
  });
});
