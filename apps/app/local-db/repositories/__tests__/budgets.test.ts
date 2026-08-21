export {};

const mockInitDatabase = jest.fn();
const mockEnqueueOperation = jest.fn();
const mockRandomUUID = jest.fn();

jest.mock("../../client", () => ({ initDatabase: (...args: unknown[]) => mockInitDatabase(...args) }));
jest.mock("../../helpers", () => {
  const actual = jest.requireActual("../../helpers");
  return { ...actual, enqueueOperation: (...args: unknown[]) => mockEnqueueOperation(...args) };
});
jest.mock("../../uuid", () => ({ randomUUID: (...args: unknown[]) => mockRandomUUID(...args) }));

function createDbMock(getFirstAsync: jest.Mock, getAllAsync = jest.fn()) {
  if (!getAllAsync.getMockImplementation()) getAllAsync.mockResolvedValue([]);
  return {
    getFirstAsync,
    getAllAsync,
    runAsync: jest.fn(),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
  };
}

describe("budget drafts repository", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset().mockResolvedValue({ operation_id: "operation-1" });
    mockRandomUUID.mockReset().mockReturnValueOnce("budget-1").mockReturnValueOnce("allocation-1");
  });

  test("rejects invalid weekly dates before writing", async () => {
    const db = createDbMock(jest.fn());
    mockInitDatabase.mockResolvedValue(db);
    const { createBudgetDraft } = await import("../budgets");

    await expect(createBudgetDraft("user-1", "device-1", {
      periodKind: "WEEKLY",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-06",
      totalAmountMinor: 10000,
      allocations: [],
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test("rejects allocations that exceed the total", async () => {
    const db = createDbMock(jest.fn());
    mockInitDatabase.mockResolvedValue(db);
    const { createBudgetDraft } = await import("../budgets");

    await expect(createBudgetDraft("user-1", "device-1", {
      periodKind: "CUSTOM",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-10",
      totalAmountMinor: 100,
      allocations: [{ categoryId: "category-1", amountMinor: 101 }],
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test("rejects a second budget for the same user", async () => {
    const db = createDbMock(jest.fn(), jest.fn(async (sql: string) => (
      sql.includes("status != 'deleted'") ? [{ id: "existing-budget" }] : []
    )));
    mockInitDatabase.mockResolvedValue(db);
    const { createBudgetDraft } = await import("../budgets");

    await expect(createBudgetDraft("user-1", "device-1", {
      periodKind: "CUSTOM",
      periodStart: "2026-09-05",
      periodEnd: "2026-09-10",
      totalAmountMinor: 1000,
      allocations: [],
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test("validates ownership before the transactional write", async () => {
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("FROM categories")) return null;
      return null;
    }));
    mockInitDatabase.mockResolvedValue(db);
    const { createBudgetDraft } = await import("../budgets");

    await expect(createBudgetDraft("user-1", "device-1", {
      periodKind: "CUSTOM",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-10",
      totalAmountMinor: 1000,
      allocations: [{ categoryId: "other-user-category", amountMinor: 100 }],
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(mockEnqueueOperation).not.toHaveBeenCalled();
  });

  test("writes the aggregate and sync operation in one transaction", async () => {
    const budgetRow = {
      id: "budget-1", user_id: "user-1", status: "draft", allocation_method: "MANUAL",
      period_kind: "CUSTOM", period_start: "2026-08-01", period_end: "2026-08-10",
      budget_period_days: 10, total_amount_minor: 1000, surplus_handling: "LEAVE_UNALLOCATED",
      deficit_handling: "BLOCK_ACTIVATION", allow_deficit_planning: 0, version: 1, deleted: 0,
    };
    const allocationRow = { id: "allocation-1", budget_id: "budget-1", category_id: "category-1", subcategory_id: null, allocated_amount_minor: 100 };
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("FROM categories")) return { id: "category-1" };
      if (sql.includes("FROM budgets")) return budgetRow;
      return null;
    }), jest.fn(async (sql: string) => sql.includes("budget_allocations") ? [allocationRow] : []));
    mockInitDatabase.mockResolvedValue(db);
    const { createBudgetDraft } = await import("../budgets");

    const result = await createBudgetDraft("user-1", "device-1", {
      periodKind: "CUSTOM", periodStart: "2026-08-01", periodEnd: "2026-08-10", totalAmountMinor: 1000,
      allocations: [{ categoryId: "category-1", amountMinor: 100 }],
    });

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockEnqueueOperation).toHaveBeenCalledWith(db, expect.objectContaining({ entity: "budgets", operationType: "create" }));
    expect(result.budget.allocatedAmountMinor).toBe(100);
    expect(result.budget.unallocatedAmountMinor).toBe(900);
  });

  test("queues budget updates with the API field names", async () => {
    const budgetRow = {
      id: "budget-1", user_id: "user-1", status: "draft", allocation_method: "MANUAL",
      period_kind: "CUSTOM", period_start: "2026-08-01", period_end: "2026-08-10",
      budget_period_days: 10, total_amount_minor: 1000, surplus_handling: "LEAVE_UNALLOCATED",
      deficit_handling: "BLOCK_ACTIVATION", allow_deficit_planning: 0, version: 1, deleted: 0,
    };
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("FROM categories") || sql.includes("FROM budgets")) return budgetRow;
      return null;
    }), jest.fn(async (sql: string) => sql.includes("budget_allocations") ? [] : []));
    mockInitDatabase.mockResolvedValue(db);
    const { updateBudgetDraft } = await import("../budgets");

    await updateBudgetDraft("user-1", "device-1", "budget-1", {
      periodKind: "CUSTOM", periodStart: "2026-08-01", periodEnd: "2026-08-10",
      totalAmountMinor: 1000, allocations: [{ categoryId: "category-1", amountMinor: 100 }],
    });

    expect(mockEnqueueOperation).toHaveBeenCalledWith(db, expect.objectContaining({
      changedFields: ["periodKind", "periodStart", "periodEnd", "budget_period_days", "totalAmountMinor", "allocations"],
    }));
  });

  test("tracks category and subcategory allocations independently", async () => {
    const budgetRow = {
      id: "budget-1", user_id: "user-1", status: "draft", allocation_method: "MANUAL",
      period_kind: "CUSTOM", period_start: "2026-08-01", period_end: "2026-08-10",
      budget_period_days: 10, total_amount_minor: 1000, surplus_handling: "LEAVE_UNALLOCATED",
      deficit_handling: "BLOCK_ACTIVATION", allow_deficit_planning: 0, version: 1, deleted: 0,
    };
    const allocationRows = [
      { id: "allocation-category", budget_id: "budget-1", category_id: "category-1", subcategory_id: null, allocated_amount_minor: 100 },
      { id: "allocation-subcategory", budget_id: "budget-1", category_id: null, subcategory_id: "subcategory-1", allocated_amount_minor: 200 },
    ];
    const db = createDbMock(jest.fn(async (sql: string) => sql.includes("FROM budgets") ? budgetRow : null), jest.fn(async (sql: string) => {
      if (sql.includes("budget_allocations") && sql.includes("actual_amount_minor")) return [
        { id: "allocation-category", actual_amount_minor: 75 },
        { id: "allocation-subcategory", actual_amount_minor: 25 },
      ];
      return sql.includes("budget_allocations") ? allocationRows : [];
    }));
    mockInitDatabase.mockResolvedValue(db);
    const { getBudgetDraftTracking } = await import("../budgets");

    const result = await getBudgetDraftTracking("user-1", "budget-1");
    const trackingCall = db.getAllAsync.mock.calls.find(([sql]) => sql.includes("actual_amount_minor"));
    const trackingQuery = trackingCall?.[0] as string;

    expect(result?.allocations.map(({ id, actualAmountMinor }) => ({ id, actualAmountMinor }))).toEqual([
      { id: "allocation-category", actualAmountMinor: 75 },
      { id: "allocation-subcategory", actualAmountMinor: 25 },
    ]);
    expect(trackingQuery).toContain("t.transaction_type = 'expense'");
    expect(trackingQuery).toContain("s.user_id = ?");
    expect(trackingQuery).toContain("s.kind = 'expense'");
    expect(trackingQuery).toContain("s.is_active = 1");
    expect(trackingQuery).toContain("c.user_id = ? OR c.is_system = 1");
    expect(trackingQuery).toContain("t.transaction_date >= ? AND t.transaction_date <= ?");
    expect(trackingCall?.slice(1)).toEqual([
      "user-1",
      "2026-08-01",
      "2026-08-10",
      "user-1",
      "user-1",
      "user-1",
      "user-1",
      "budget-1",
      "user-1",
      "user-1",
    ]);
  });
});
