import { applyPullRow, normalizePullRow, type PullDb } from "../pullConvergence";

const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => { exec(sql: string): void; prepare(sql: string): { get(...params: unknown[]): unknown; run(...params: unknown[]): void } } };

function fakeDb(existing: { version: number; user_id: string } | null): PullDb & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    getFirstAsync: async <T>(_sql: string) => {
      const sql = _sql;
      calls.push(sql);
      return existing as T | null;
    },
    runAsync: async (sql: string) => {
      calls.push(sql);
      return {} as never;
    },
  };
}

test("uses user_id as the strategy preference identity", async () => {
  const db = fakeDb({ version: 1, user_id: "user-1" });
  await applyPullRow(db, "debt_strategy_preferences", { user_id: "user-1", strategy: "snowball", version: 2, deleted: false });
  expect(db.calls[0]).toContain('WHERE "user_id" = ?');
  expect(db.calls.at(-1)).toContain('WHERE "user_id" = ? AND user_id = ?');
  expect(db.calls.at(-1)).not.toContain('WHERE id = ?');
});

test("deletes debt tables without is_active", async () => {
  for (const table of ["debt_accounts", "debt_payments", "user_debt_priorities", "debt_strategy_preferences"]) {
    const db = fakeDb({ version: 1, user_id: "user-1" });
    await applyPullRow(db, table, { id: "debt-1", user_id: "user-1", version: 2, deleted: true });
    expect(db.calls.at(-1)).not.toContain("is_active");
  }
});

test("serializes remote debt preset data for SQLite", () => {
  const normalized = normalizePullRow("debt_accounts", {
    id: "debt-1", user_id: "user-1", preset_data: { issuer: "BPI" }, payment_schedule: { intervalCount: "1" },
  }, "user-1");
  expect(normalized.preset_data).toBe('{"issuer":"BPI"}');
  expect(normalized.payment_schedule).toBe('{"intervalCount":"1"}');
});

test("moves a colliding priority rank before applying a remote row", async () => {
  const db = fakeDb({ version: 1, user_id: "user-1" });
  await applyPullRow(db, "user_debt_priorities", { id: "priority-2", user_id: "user-1", debt_account_id: "debt-2", priority_rank: 1, version: 2, deleted: false });
  expect(db.calls[0]).toContain("priority_rank = -priority_rank - 1000000");
});

test("replaces a local live budget with the server budget", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE budgets (id text primary key, user_id text, status text, deleted integer, version integer, updated_at text);
    CREATE UNIQUE INDEX idx_budgets_one_live_per_user ON budgets (user_id) WHERE deleted = 0 AND status != 'deleted';
    INSERT INTO budgets VALUES ('local-budget', 'user-1', 'draft', 0, 1, '2026-08-01');
  `);
  const db: PullDb = {
    getFirstAsync: async <T>(sql: string, ...params: unknown[]) => (sqlite.prepare(sql).get(...params) ?? null) as T | null,
    runAsync: async (sql: string, ...params: unknown[]) => {
      sqlite.prepare(sql).run(...params);
      return {} as never;
    },
  };

  await expect(applyPullRow(db, "budgets", {
    id: "server-budget", user_id: "user-1", status: "draft", deleted: 0, version: 1, updated_at: "2026-08-02",
  })).resolves.toBeUndefined();
  expect(sqlite.prepare("SELECT deleted FROM budgets WHERE id = 'local-budget'").get()).toEqual({ deleted: 1 });
});
