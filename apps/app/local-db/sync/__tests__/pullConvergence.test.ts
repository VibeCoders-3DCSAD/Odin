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

test("serializes remote debt payment schedules for SQLite", () => {
  expect(normalizePullRow("debt_accounts", { id: "debt-1", user_id: "user-1", payment_schedule: { day: 15 } }, "user-1").payment_schedule).toBe('{"day":15}');
});

test("pulls the debt archive timestamp and clears it when the server clears it", () => {
  expect(normalizePullRow("debt_accounts", { id: "debt-1", user_id: "user-1", archived_at: "2026-08-21T10:00:00Z" }, "user-1").archived_at).toBe("2026-08-21T10:00:00Z");
  expect(normalizePullRow("debt_accounts", { id: "debt-1", user_id: "user-1", archived_at: null }, "user-1").archived_at).toBeNull();
});

test("normalizes an invalid pulled paid-off debt to active", () => {
  expect(normalizePullRow("debt_accounts", {
    id: "debt-1", user_id: "user-1", status: "paid_off", current_balance_centavos: 100,
    paid_off_at: "2026-08-21T10:00:00Z",
  }, "user-1")).toMatchObject({ status: "active", paid_off_at: null });
});

test("moves a colliding priority rank before applying a remote row", async () => {
  const db = fakeDb({ version: 1, user_id: "user-1" });
  await applyPullRow(db, "user_debt_priorities", { id: "priority-2", user_id: "user-1", debt_account_id: "debt-2", priority_rank: 1, version: 2, deleted: false });
  expect(db.calls[0]).toContain("priority_rank = -priority_rank - 1000000");
});

test("matches pulled priorities by debt account instead of random row id", async () => {
  const db = fakeDb({ version: 1, user_id: "user-1" });
  await applyPullRow(db, "user_debt_priorities", {
    id: "remote-random-id", user_id: "user-1", debt_account_id: "debt-1",
    priority_rank: 2, version: 2, deleted: false,
  });
  expect(db.calls[1]).toContain('WHERE "debt_account_id" = ?');
  expect(db.calls[1]).not.toContain('WHERE "id" = ?');
});

test.each([
  ["credit_card_details", "account_id"],
  ["credit_card_cycles", "id"],
  ["credit_card_installments", "id"],
  ["credit_card_transactions", "transaction_id"],
  ["credit_card_statements", "id"],
  ["credit_card_payments", "id"],
  ["credit_card_credit_applications", "id"],
  ["credit_card_settlements", "id"],
  ["credit_card_statement_strategies", "statement_id"],
])("uses %s identity %s", async (table, identity) => {
  const db = fakeDb({ version: 1, user_id: "user-1" });
  await applyPullRow(db, table, { [identity]: "record-1", user_id: "user-1", version: 2, deleted: false });
  expect(db.calls[0]).toContain(`"${identity}" = ?`);
});

test.each(["credit_card_details", "credit_card_cycles", "credit_card_installments", "credit_card_transactions", "credit_card_statements", "credit_card_payments", "credit_card_credit_applications", "credit_card_settlements", "credit_card_statement_strategies"])("does not set nonexistent status on %s tombstones", async (table) => {
  const db = fakeDb({ version: 1, user_id: "user-1" });
  await applyPullRow(db, table, { id: "record-1", account_id: "record-1", statement_id: "record-1", transaction_id: "record-1", user_id: "user-1", version: 2, deleted: true });
  expect(db.calls.at(-1)).not.toContain("status =");
});

test("pulling a remote card purchase does not mutate card credit", async () => {
  const db = fakeDb({ version: 1, user_id: "user-1" });
  await applyPullRow(db, "credit_card_transactions", { transaction_id: "tx-1", user_id: "user-1", account_id: "card-1", cycle_id: "cycle-1", purchase_type: "regular", version: 2, deleted: false });
  expect(db.calls.filter((call) => call.includes("credit_card_details") && call.includes("UPDATE")).length).toBe(0);
});

test("preserves card operation fields during pull normalization", () => {
  expect(normalizePullRow("credit_card_transactions", {
    transaction_id: "tx-1", user_id: "user-1", client_mutation_id: "purchase-1", applied_credit_centavos: 250,
  }, "user-1")).toMatchObject({ client_mutation_id: "purchase-1", applied_credit_centavos: 250 });
  expect(normalizePullRow("credit_card_payments", {
    id: "payment-1", user_id: "user-1", client_mutation_id: "payment-1", issuer_recognized: true,
  }, "user-1")).toMatchObject({ client_mutation_id: "payment-1", issuer_recognized: 1 });
});
