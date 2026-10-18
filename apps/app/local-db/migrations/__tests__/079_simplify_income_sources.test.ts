import migration from "../079_simplify_income_sources";

describe("simplify income sources migration", () => {
  it("discards queued work for removed sources before dropping the variable-income columns", async () => {
    const execAsync = jest.fn(async (_sql: string) => undefined);

    await migration.up({ execAsync } as never);

    const sql = String(execAsync.mock.calls[0]?.[0]);
    expect(sql).toContain("frequency NOT IN ('weekly', 'semi_monthly', 'monthly')");
    expect(sql).toContain("payday_day_of_month >= MIN(payday_second_day_of_month, 28)");
    expect(sql).toContain("DELETE FROM income_sources WHERE id IN (SELECT id FROM retired_income_sources)");
    for (const column of ["income_type", "min_amount_centavos", "max_amount_centavos", "estimated_interval_days", "payday_second_day_of_week"]) {
      expect(sql).toContain(`ALTER TABLE income_sources DROP COLUMN ${column};`);
    }
    expect(sql.indexOf("UPDATE sync_queue")).toBeLessThan(sql.indexOf("DELETE FROM income_sources"));
  });
});
