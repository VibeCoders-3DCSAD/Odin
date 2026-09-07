import { jest } from "@jest/globals";
import { applyPullRow } from "../pullConvergence";

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
