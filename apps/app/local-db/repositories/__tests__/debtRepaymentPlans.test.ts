import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
const mockEnqueueOperation = jest.fn<(...args: any[]) => any>();

jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));
jest.mock("../../helpers", () => ({
  LocalDbError: class LocalDbError extends Error {},
  enqueueOperation: (...args: unknown[]) => mockEnqueueOperation(...args),
}));
jest.mock("../../uuid", () => ({ randomUUID: () => "priority-1" }));

describe("saveDebtPriorities", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset().mockResolvedValue({ operation_id: "sync-1" });
  });

  it("queues the local priority version expected by the remote conflict guard", async () => {
    const db = {
      getAllAsync: jest.fn(async () => [{ id: "debt-1" }]),
      getFirstAsync: jest.fn(async () => ({ version: 5 })),
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (work: (tx: unknown) => Promise<void>) => work(db)),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { saveDebtPriorities } = await import("../debtRepaymentPlans");
    await saveDebtPriorities("user-1", "device-1", ["debt-1"]);

    expect(mockEnqueueOperation).toHaveBeenCalledWith(db, expect.objectContaining({
      entity: "user_debt_priorities",
      baseVersion: 5,
      payload: { priorities: ["debt-1"] },
    }));
  });
});
