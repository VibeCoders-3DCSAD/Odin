import { jest } from "@jest/globals";
import { applyPullRow, normalizePullRow } from "../pullConvergence";

describe("credit-card cycle pull convergence", () => {
  it("does not update immutable dates on a recorded cycle", async () => {
    const db = {
      getFirstAsync: jest.fn(async () => ({ version: 1, user_id: "user-1", statement_date: "2026-02-01" })),
      runAsync: jest.fn<(...args: any[]) => any>(async () => ({ changes: 1 })),
    };

    await applyPullRow(db as never, "credit_card_cycles", {
      id: "cycle-1", user_id: "user-1", account_id: "card-1",
      cycle_start_date: "2026-01-01", cutoff_date: "2026-01-31", statement_date: "2026-02-02",
      version: 2, deleted: 0, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-02-02T00:00:00.000Z",
      last_synced_at: "2026-02-02T00:00:00.000Z",
    });

    const sql = String(db.runAsync.mock.calls[0]?.[0]);
    expect(sql).not.toContain('"cycle_start_date" = ?');
    expect(sql).not.toContain('"cutoff_date" = ?');
    expect(sql).toContain('"statement_date" = ?');
  });
});

describe("debt account pull convergence", () => {
  it("serializes debt JSON fields before inserting the remote record", async () => {
    const row = normalizePullRow("debt_accounts", {
      id: "debt-1", user_id: "user-1", linked_account_id: null, name: "Car loan", lender_name: "Bank",
      preset_key: "auto_loan", status: "active", original_balance_centavos: 500000,
      current_balance_centavos: 450000, annual_interest_rate_bps: 650, minimum_payment_centavos: 15000,
      payment_frequency: "monthly", next_due_date: "2026-10-01", maturity_date: null,
      target_payoff_date: null, interest_period: "annual", interest_method: "diminishing_balance",
      preset_data: { startDate: "2026-01-01" }, payment_schedule: { termMonths: 48 }, notes: null,
      paid_off_at: null, archived_at: null, version: 1, deleted: false,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    }, "user-1");
    const db = { getFirstAsync: jest.fn(async () => null), runAsync: jest.fn<(...args: any[]) => any>(async () => ({ changes: 1 })) };

    await applyPullRow(db as never, "debt_accounts", row);

    const args = db.runAsync.mock.calls[0] ?? [];
    expect(String(args[0])).toContain('INSERT INTO "debt_accounts"');
    expect(args).toContain("{\"startDate\":\"2026-01-01\"}");
    expect(args).toContain("{\"termMonths\":48}");
  });

  it("soft-deletes a pulled debt without writing an unrelated is_active column", async () => {
    const db = { getFirstAsync: jest.fn(async () => ({ version: 1, user_id: "user-1" })), runAsync: jest.fn<(...args: any[]) => any>(async () => ({ changes: 1 })) };
    await applyPullRow(db as never, "debt_accounts", { id: "debt-1", user_id: "user-1", version: 2, deleted: true });
    expect(String(db.runAsync.mock.calls[0]?.[0])).toContain("status = 'deleted'");
    expect(String(db.runAsync.mock.calls[0]?.[0])).not.toContain("is_active");
  });
});

describe("credit-card payment pull convergence", () => {
  it("soft-deletes a payment without writing an unrelated is_active column", async () => {
    const db = { getFirstAsync: jest.fn(async () => ({ version: 1, user_id: "user-1" })), runAsync: jest.fn<(...args: any[]) => any>(async () => ({ changes: 1 })) };
    await applyPullRow(db as never, "credit_card_payments", { id: "payment-1", user_id: "user-1", version: 2, deleted: true });
    const sql = String(db.runAsync.mock.calls[0]?.[0]);
    expect(sql).toContain("deleted = 1");
    expect(sql).not.toContain("is_active");
  });
});
