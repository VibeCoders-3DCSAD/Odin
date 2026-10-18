import migration from "../061_remove_legacy_taxonomy";

describe("061_remove_legacy_taxonomy", () => {
  it("skips legacy cleanup when category groups were already removed", async () => {
    const execAsync = jest.fn(async () => undefined);
    const getFirstAsync = jest.fn(async (sql: string) => {
      if (sql.includes("sqlite_master")) return null;
      return null;
    });

    await migration.up({ execAsync, getFirstAsync } as never);

    expect(execAsync).not.toHaveBeenCalled();
  });
});
