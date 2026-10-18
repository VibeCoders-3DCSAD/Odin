import migration from "../071_remove_category_groups";

it("rebuilds categories without the category-group foreign key", async () => {
  const execAsync = jest.fn(async () => undefined);
  const getFirstAsync = jest.fn(async (sql: string) => {
    if (sql.includes("sqlite_master")) return { name: "category_groups" };
    return { name: "category_group_id" };
  });

  await migration.up({ execAsync, getFirstAsync } as never);

  const sql = String((execAsync.mock.calls as unknown[][])[0]?.[0]);
  expect(sql).toContain("CREATE TABLE categories_without_groups");
  expect(sql).toContain("DROP TABLE category_groups");
  expect(sql).not.toContain("category_group_id");
});
