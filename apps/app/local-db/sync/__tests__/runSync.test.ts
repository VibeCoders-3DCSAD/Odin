import { jest } from "@jest/globals";

jest.mock("../../client", () => ({
  initDatabase: jest.fn(),
}));

import { initDatabase } from "../../client";
import { runSync } from "../runSync";

const mockInitDatabase = initDatabase as jest.Mock;

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
    global.fetch = fetchMock as typeof fetch;

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
    global.fetch = fetchMock as typeof fetch;

    const result = await runSync("user-c", "device-c", "token-c");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.hasMore).toBe(true);
  });
});
