import { applyPullRow, normalizePullRow, type PullDb } from "../pullConvergence";

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
  expect(normalizePullRow("debt_accounts", { id: "debt-1", user_id: "user-1", preset_data: { issuer: "BPI" } }, "user-1").preset_data).toBe('{"issuer":"BPI"}');
});

test("moves a colliding priority rank before applying a remote row", async () => {
  const db = fakeDb({ version: 1, user_id: "user-1" });
  await applyPullRow(db, "user_debt_priorities", { id: "priority-2", user_id: "user-1", debt_account_id: "debt-2", priority_rank: 1, version: 2, deleted: false });
  expect(db.calls[0]).toContain("priority_rank = -priority_rank - 1000000");
});
