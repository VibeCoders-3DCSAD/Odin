import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
const mockEnqueueOperation = jest.fn<(...args: any[]) => any>();

jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));
jest.mock("../../helpers", () => ({ enqueueOperation: (...args: any[]) => mockEnqueueOperation(...args) }));
jest.mock("../../uuid", () => ({ randomUUID: () => "evaluation-1" }));

describe("saveUnusualSpending", () => {
  beforeEach(() => { jest.resetModules(); mockInitDatabase.mockReset(); mockEnqueueOperation.mockReset(); });

  it("stores one immutable evaluation and queues it after its transaction", async () => {
    const runAsync = jest.fn<(...args: any[]) => any>();
    const getFirstAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue({ id: "evaluation-1" });
    mockInitDatabase.mockResolvedValue({
      withTransactionAsync: async (callback: () => Promise<void>) => callback(),
      runAsync,
      getFirstAsync,
    });
    const { _resetDbCacheForTesting, saveUnusualSpending } = await import("../unusualSpending");
    _resetDbCacheForTesting();

    await saveUnusualSpending("user-1", "device-1", {
      transactionId: "transaction-1", subcategoryId: "subcategory-1", amountCentavos: 100_000,
      subcategoryLabel: "Groceries", accountName: "Cash", transactionDate: "2026-10-30",
      usualSpendingCentavos: 12_500, lowerBoundCentavos: 7_500, upperBoundCentavos: 20_000,
      severity: 1.2, usableHistoryCount: 6,
    });

    expect(runAsync.mock.calls[0]?.[0]).toContain("INSERT OR IGNORE INTO anomaly_evaluations");
    expect(mockEnqueueOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      entity: "anomaly_evaluations", recordId: "evaluation-1", operationType: "create",
      payload: expect.objectContaining({ transaction_id: "transaction-1", subcategory_id: "subcategory-1" }),
    }));
  });
});
