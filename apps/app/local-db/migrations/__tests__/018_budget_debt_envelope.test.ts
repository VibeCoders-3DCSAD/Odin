import migration from "../018_budget_debt_envelope";

describe("budget debt envelope migration", () => {
  it("adds a non-negative local debt budget field with a zero default", async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);

    await migration.up({ execAsync } as never);

    expect(execAsync).toHaveBeenCalledWith(
      "ALTER TABLE budgets ADD COLUMN debt_budget_amount_minor integer NOT NULL DEFAULT 0;",
    );
  });
});
