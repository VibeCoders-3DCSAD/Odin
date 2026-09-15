import migration from "../059_budget_savings_envelope";

describe("budget savings envelope migration", () => {
  it("adds a non-negative local savings budget field with a zero default", async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);

    await migration.up({ execAsync } as never);

    expect(execAsync).toHaveBeenCalledWith(
      "ALTER TABLE budgets ADD COLUMN savings_budget_amount_minor integer NOT NULL DEFAULT 0;",
    );
  });
});
