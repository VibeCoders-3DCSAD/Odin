import { prepareOperation } from "../../services/syncApplyOperation.js";

function createSupabaseStub() {
  return {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        neq: () => query,
        limit: () => query,
        in: () => query,
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return query;
    },
  } as never;
}

function budgetOperation(debtBudgetAmountMinor: number, savingsBudgetAmountMinor = 0) {
  return {
    operation_id: "operation-1", entity: "budgets", record_id: "budget-1", operation_type: "create" as const,
    base_version: null, changed_fields: [],
    payload: {
      status: "draft", allocation_method: "MANUAL", periodKind: "MONTHLY", periodStart: "2026-04-01",
      periodEnd: "2026-05-01", budget_period_days: 31, totalAmountMinor: 10_000,
      debtBudgetAmountMinor, savingsBudgetAmountMinor, allocations: [], surplus_handling: "LEAVE_UNALLOCATED",
      deficit_handling: "BLOCK_ACTIVATION", allow_deficit_planning: false,
    },
  };
}

describe("budget sync payload", () => {
  it("accepts the canonical debt budget minor-unit field", async () => {
    const prepared = await prepareOperation(createSupabaseStub(), "user-1", budgetOperation(2_500));

    expect(prepared.payload.debtBudgetAmountMinor).toBe(2_500);
  });

  it("accepts the canonical savings envelope minor-unit field", async () => {
    const prepared = await prepareOperation(createSupabaseStub(), "user-1", budgetOperation(2_500, 1_500));

    expect(prepared.payload.savingsBudgetAmountMinor).toBe(1_500);
  });

  it("rejects a debt budget that exceeds the total budget", async () => {
    await expect(prepareOperation(createSupabaseStub(), "user-1", budgetOperation(10_000, 1))).rejects.toThrow(
      "allocations, debt budget, and savings budget cannot exceed the budget total",
    );
  });
});
