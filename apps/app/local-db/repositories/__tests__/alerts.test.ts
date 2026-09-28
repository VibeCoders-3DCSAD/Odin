import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();

jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));

describe("alert cache", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
  });

  it("binds one value for every alert-cache upsert placeholder", async () => {
    const db = {
      withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
      runAsync: jest.fn(async (sql: string, ...values: unknown[]) => {
        const placeholders = (sql.match(/\?/g) ?? []).length;
        if (placeholders !== values.length) throw new Error("SQLite bind parameter count mismatch");
      }),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { replaceAlertPage } = await import("../alerts");
    await expect(replaceAlertPage("user-1", [{
      id: "alert-1", category: "anomaly_detection", severity: "medium", status: "unread",
      title: "Unusual spending detected", body: "Review this transaction.", explanation: null,
      action_label: "Review transaction", route_name: "transactions", route_params: {}, related_entities: [], metadata: {},
      remote_revision: "1", triggered_at: "2026-09-23T00:00:00.000Z", read_at: null, acknowledged_at: null,
      dismissed_at: null, remind_at: null, expires_at: null, allowed_actions: ["read", "acknowledge"],
    }])).resolves.toBeUndefined();
  });
});
