import migration from "../032_drop_account_credit_limit";

describe("drop-account-credit-limit migration", () => {
  test("drops account credit limit and adds credit-card form fields with schema-level checks", async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);

    await migration.up({ execAsync } as never);

    const sql = execAsync.mock.calls[0]?.[0] as string;
    expect(sql).toContain("ALTER TABLE financial_accounts DROP COLUMN credit_limit_centavos");
    expect(sql).toContain("billing_cycle_days integer CHECK (billing_cycle_days BETWEEN 28 AND 31)");
    expect(sql).toContain("alert_threshold_percent integer CHECK (alert_threshold_percent BETWEEN 0 AND 100)");
  });
});