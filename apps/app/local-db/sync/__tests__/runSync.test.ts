import { jest } from "@jest/globals";

jest.mock("../../client", () => ({
  initDatabase: jest.fn(),
}));

import { initDatabase } from "../../client";
import { runSync } from "../runSync";

const mockInitDatabase = initDatabase as jest.Mock<any>;

function createDb() {
  return {
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async (sql: string) => {
      if (sql.includes("COUNT(*)")) return { count: 1 };
      return null;
    }),
    runAsync: jest.fn(async () => ({})),
  };
}

describe("runSync concurrency", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitDatabase.mockResolvedValue(createDb());
  });

  it("coalesces calls per user and device without sharing across users", async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes("register-device")) return { ok: true };
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        ok: true,
        json: async () => ({ payload: { changes: {}, cursors: {}, successful: true } }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await Promise.all([
      runSync("user-a", "device-a", "token-a"),
      runSync("user-a", "device-a", "token-a"),
      runSync("user-b", "device-b", "token-b"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("limits pagination to three pull pages per sync", async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes("register-device")) return { ok: true };
      return {
        ok: true,
        json: async () => ({
          payload: {
            changes: {},
            cursors: {},
            has_more: { transactions: true },
            successful: true,
          },
        }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runSync("user-c", "device-c", "token-c");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.hasMore).toBe(true);
  });

  it("pushes transactions before linked debt payments and treats replay as synced", async () => {
    const transaction = { operation_id: "transaction-op", entity: "transactions", record_id: "transaction-1", operation_type: "create", base_version: null, changed_fields: [], payload: {} };
    const payment = { operation_id: "payment-op", entity: "debt_payments", record_id: "payment-1", operation_type: "create", base_version: null, changed_fields: [], payload: {} };
    const queueRows = [
      { ...payment, user_id: "user-order", device_id: "device-order", status: "pending", attempts: 0, created_at: "2026-08-01", last_error: null, payload: "{}", changed_fields: "[]" },
      { ...transaction, user_id: "user-order", device_id: "device-order", status: "pending", attempts: 0, created_at: "2026-08-02", last_error: null, payload: "{}", changed_fields: "[]" },
    ];
    let queueQuery = "";
    const database: any = createDb();
    database.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM sync_queue")) {
        queueQuery = sql;
        return queueRows;
      }
      return [];
    });
    mockInitDatabase.mockResolvedValue(database);
    global.fetch = jest.fn(async (url: string) => url.includes("register-device")
      ? { ok: true }
      : url.includes("/push")
        ? { ok: true, json: async () => ({ payload: { results: [{ operation_id: "transaction-op", status: "duplicate" }, { operation_id: "payment-op", status: "duplicate" }] } }) }
        : { ok: true, json: async () => ({ payload: { changes: {}, cursors: {}, successful: true } }) }) as unknown as typeof fetch;

    await runSync("user-order", "device-order", "token-order");

    expect(queueQuery).toContain("CASE WHEN entity = 'transactions' THEN 0 WHEN entity = 'debt_payments' THEN 1");
    expect(database.runAsync).toHaveBeenCalledWith("UPDATE sync_queue SET status = 'synced' WHERE operation_id = ?", "transaction-op");
    expect(database.runAsync).toHaveBeenCalledWith("UPDATE sync_queue SET status = 'synced' WHERE operation_id = ?", "payment-op");
  });

  it("discards a local budget that collides with the server's active budget", async () => {
    const budget = {
      operation_id: "budget-op", entity: "budgets", record_id: "budget-1", operation_type: "create",
      base_version: null, changed_fields: "[]", payload: "{}", user_id: "user-budget",
      device_id: "device-budget", status: "pending", attempts: 0, created_at: "2026-08-01", last_error: null,
    };
    const database: any = createDb();
    database.getAllAsync.mockImplementation(async (sql: string) => sql.includes("FROM sync_queue") ? [budget] : []);
    mockInitDatabase.mockResolvedValue(database);
    global.fetch = jest.fn(async (url: string) => url.includes("register-device")
      ? { ok: true }
      : url.includes("/push")
        ? { ok: true, json: async () => ({ payload: { results: [{ operation_id: "budget-op", status: "conflict", reason: "active_budget_exists" }] } }) }
        : { ok: true, json: async () => ({ payload: { changes: {}, cursors: {}, successful: true } }) }) as unknown as typeof fetch;

    await runSync("user-budget", "device-budget", "token-budget");

    expect(database.runAsync).toHaveBeenCalledWith(
      "UPDATE budgets SET status = 'deleted', deleted = 1, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?",
      "user-budget",
      "budget-1",
    );
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE sync_queue SET status = 'discarded'"),
      expect.any(String),
      "budget-op",
    );
  });
});
