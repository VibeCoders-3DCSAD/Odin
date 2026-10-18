import migration from "../080_taxonomy_visuals";

describe("080_taxonomy_visuals", () => {
  it("adds visual fields to categories and subcategories", async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);

    await migration.up({ execAsync } as never);

    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining("ALTER TABLE categories ADD COLUMN icon_key"));
    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining("ALTER TABLE subcategories ADD COLUMN color_hex"));
  });
});
