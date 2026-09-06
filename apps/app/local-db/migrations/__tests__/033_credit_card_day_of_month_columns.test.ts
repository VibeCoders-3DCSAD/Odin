import migration from "../033_credit_card_day_of_month_columns";

describe("credit-card day-of-month columns migration", () => {
  test("renames old date columns and converts dates to day numbers", async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const getAllAsync = jest.fn().mockResolvedValue([
      { name: "account_id" },
      { name: "default_cutoff_date" },
      { name: "default_statement_date" },
    ]);

    await migration.up({ execAsync, getAllAsync } as never);

    expect(getAllAsync).toHaveBeenCalledWith("PRAGMA table_info(credit_card_details)");
    const renameSql = execAsync.mock.calls[0]?.[0] as string;
    expect(renameSql).toContain("default_cutoff_date TO cutoff_day");
    expect(renameSql).toContain("default_statement_date TO statement_day");
    const updateSql = execAsync.mock.calls[1]?.[0] as string;
    expect(updateSql).toContain("CAST(substr(cutoff_day, 9, 2) AS INTEGER)");
    expect(updateSql).toContain("CAST(substr(statement_day, 9, 2) AS INTEGER)");
  });

  test("no-ops on fresh schema that already has new columns", async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const getAllAsync = jest.fn().mockResolvedValue([
      { name: "account_id" },
      { name: "cutoff_day" },
      { name: "statement_day" },
    ]);

    await migration.up({ execAsync, getAllAsync } as never);

    expect(execAsync).not.toHaveBeenCalled();
  });
});