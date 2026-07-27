import { jest } from "@jest/globals";

const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
  type: { "": null },
}));
jest.mock("../../client", () => ({
  initDatabase: jest.fn(),
}));

import {
  upsertSnapshot,
  getSnapshot,
  getAllSnapshots,
  deleteSnapshot,
  _resetDbCacheForTesting,
} from "../dashboardSnapshots";

beforeEach(() => {
  _resetDbCacheForTesting();
  mockRunAsync.mockReset();
  mockGetFirstAsync.mockReset();
  mockGetAllAsync.mockReset();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initDatabase } = require("../../client");
  initDatabase.mockImplementation(() =>
    Promise.resolve({
      runAsync: mockRunAsync,
      getFirstAsync: mockGetFirstAsync,
      getAllAsync: mockGetAllAsync,
    }),
  );
});

describe("getSnapshot", () => {
  it("returns null when no snapshot exists", async () => {
    mockGetFirstAsync.mockResolvedValue(null);

    const result = await getSnapshot("user-1", "budget_health");

    expect(result).toBeNull();
  });

  it("returns fresh snapshot when within stale threshold", async () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    mockGetFirstAsync.mockResolvedValue({
      id: "s1",
      user_id: "user-1",
      source: "budget_health",
      payload_json: '{"status":"ok"}',
      updated_at: recent,
    });

    const result = await getSnapshot("user-1", "budget_health");

    expect(result).not.toBeNull();
    expect(result?.stale).toBe(false);
    expect(result?.source).toBe("budget_health");
  });

  it("returns stale snapshot when past threshold", async () => {
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    mockGetFirstAsync.mockResolvedValue({
      id: "s2",
      user_id: "user-1",
      source: "alerts",
      payload_json: '{"count":3}',
      updated_at: old,
    });

    const result = await getSnapshot("user-1", "alerts");

    expect(result).not.toBeNull();
    expect(result?.stale).toBe(true);
  });

  it("scopes by user_id and source", async () => {
    mockGetFirstAsync.mockResolvedValue(null);

    await getSnapshot("user-42", "forecast");

    expect(mockGetFirstAsync).toHaveBeenCalledWith(
      expect.any(String),
      "user-42",
      "forecast",
    );
  });
});

describe("getAllSnapshots", () => {
  it("returns null for all sources when no rows exist", async () => {
    mockGetAllAsync.mockResolvedValue([]);

    const result = await getAllSnapshots("user-1");

    expect(result.budget_health).toBeNull();
    expect(result.alerts).toBeNull();
    expect(result.savings_goals).toBeNull();
    expect(result.debt_status).toBeNull();
    expect(result.forecast).toBeNull();
  });

  it("populates only sources that have rows", async () => {
    const now = new Date().toISOString();
    mockGetAllAsync.mockResolvedValue([
      {
        id: "s1",
        user_id: "user-1",
        source: "budget_health",
        payload_json: '{"healthy":true}',
        updated_at: now,
      },
      {
        id: "s2",
        user_id: "user-1",
        source: "forecast",
        payload_json: '{"copy":"hello"}',
        updated_at: now,
      },
    ]);

    const result = await getAllSnapshots("user-1");

    expect(result.budget_health).not.toBeNull();
    expect(result.budget_health?.source).toBe("budget_health");
    expect(result.forecast).not.toBeNull();
    expect(result.alerts).toBeNull();
    expect(result.savings_goals).toBeNull();
    expect(result.debt_status).toBeNull();
  });

  it("scopes by user_id", async () => {
    mockGetAllAsync.mockResolvedValue([]);

    await getAllSnapshots("user-99");

    expect(mockGetAllAsync).toHaveBeenCalledWith(
      expect.any(String),
      "user-99",
    );
  });
});

describe("upsertSnapshot", () => {
  it("calls runAsync with INSERT and upsert SQL", async () => {
    mockRunAsync.mockResolvedValue(undefined);

    await upsertSnapshot("user-1", "savings_goals", { progress: 42 });

    expect(mockRunAsync).toHaveBeenCalledTimes(1);
    const [sql, ...bindValues] = mockRunAsync.mock.calls[0];
    expect(sql).toContain("INSERT INTO dashboard_snapshots");
    expect(sql).toContain("ON CONFLICT(user_id, source)");
    expect(bindValues).toContain("user-1");
    expect(bindValues).toContain("savings_goals");
    expect(bindValues).toContain(JSON.stringify({ progress: 42 }));
  });
});

describe("deleteSnapshot", () => {
  it("deletes by user_id and source", async () => {
    mockRunAsync.mockResolvedValue(undefined);

    await deleteSnapshot("user-1", "debt_status");

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM dashboard_snapshots"),
      "user-1",
      "debt_status",
    );
  });
});
