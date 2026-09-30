import migration from "../067_drop_legacy_budget_tables";

describe("drop legacy budget tables migration", () => {
  it("discards queued legacy operations before dropping their tables", async () => {
    const execAsync = jest.fn(async () => undefined);

    await migration.up({ execAsync } as never);

    const sql = String(execAsync.mock.calls[0]?.[0]);
    expect(sql).toContain("WHERE entity IN ('budgets', 'budget_allocations')");
    expect(sql).toContain("DROP TABLE IF EXISTS budget_allocations");
    expect(sql).toContain("DROP TABLE IF EXISTS budgets");
  });
});
