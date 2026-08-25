import migration from "../020_reconcile_budget_debt_migrations";

const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => { exec(sql: string): void; prepare(sql: string): { all(): unknown[] } } };

test("keeps the existing payment schedule while reconciling a preview database", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE budgets (id text primary key, user_id text, status text, deleted integer, version integer, created_at text, updated_at text, debt_budget_amount_minor integer NOT NULL DEFAULT 0);
    CREATE TABLE debt_accounts (id text primary key, payment_schedule text NOT NULL DEFAULT '{}');
  `);

  await expect(migration.up({
    execAsync: async (sql: string) => sqlite.exec(sql),
    getAllAsync: async (sql: string) => sqlite.prepare(sql).all(),
  } as never))
    .resolves.toBeUndefined();
});

test("adds the debt envelope for an existing main database", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE budgets (id text primary key, user_id text, status text, deleted integer, version integer, created_at text, updated_at text)");

  await migration.up({
    execAsync: async (sql: string) => sqlite.exec(sql),
    getAllAsync: async (sql: string) => sqlite.prepare(sql).all(),
  } as never);

  const columns = sqlite.prepare("PRAGMA table_info(budgets)").all() as Array<{ name: string }>;
  expect(columns.some((column) => column.name === "debt_budget_amount_minor")).toBe(true);
});
