import migration from "../017_single_budget";

describe("single-budget migration", () => {
  test("resolves duplicate live budgets before creating the unique index", async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);

    await migration.up({ execAsync } as never);

    const sql = execAsync.mock.calls[0]?.[0] as string;
    expect(sql).toContain("ROW_NUMBER() OVER");
    expect(sql).toContain("ORDER BY updated_at DESC, created_at DESC, id DESC");
    expect(sql).toContain("SET status = 'deleted', deleted = 1");
    expect(sql.indexOf("UPDATE budgets")).toBeLessThan(sql.indexOf("CREATE UNIQUE INDEX"));
  });
});
