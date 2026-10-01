import migration from "../070_hfce_category_descriptions";

describe("HFCE category descriptions migration", () => {
  it("updates the twelve standard category descriptions only", async () => {
    const execAsync = jest.fn<Promise<void>, [string]>(async () => undefined);

    await migration.up({ execAsync } as never);

    const sql = String(execAsync.mock.calls[0]?.[0]);
    expect(sql).toContain("Rice, bread, meat, fish, seafood");
    expect(sql).toContain("Restaurant meals, cafes, fast food");
    expect(sql).toContain("WHERE slug IN");
    expect(sql).toContain("slug = 'hfce_categories'");
  });
});
