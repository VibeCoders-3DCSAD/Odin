import migration from "../077_drop_obligations_and_recurring_expenses";

describe("drop obligations and recurring expenses migration", () => {
  it("discards queued work and keeps only income-source templates", async () => {
    const execAsync = jest.fn(async (_sql: string) => undefined);

    await migration.up({ execAsync } as never);

    const sql = String(execAsync.mock.calls[0]?.[0]);
    expect(sql).toContain("WHERE entity = 'financial_obligations'");
    expect(sql).toContain("DROP TABLE IF EXISTS financial_obligations");
    expect(sql).toContain("DELETE FROM recurring_transaction_templates\n       WHERE id NOT IN (SELECT recurring_template_id FROM income_sources WHERE recurring_template_id IS NOT NULL)");
    expect(sql.indexOf("UPDATE sync_queue")).toBeLessThan(sql.indexOf("DROP TABLE"));
  });
});
