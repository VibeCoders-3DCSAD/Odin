import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));

describe("listForecastTransactions", () => {
  beforeEach(() => { jest.resetModules(); mockInitDatabase.mockReset(); });

  it("reads only the current user's posted income and expenses as category groups", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([{ id: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be", transaction_date: "2026-09-04", amount_centavos: 24550, transaction_type: "expense", merchant_name: "Market", counterparty_name: null, notes: null, category_group_label: "Essentials" }]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { _resetDbCacheForTesting, listForecastTransactions } = await import("../forecastTransactions");
    _resetDbCacheForTesting();
    await expect(listForecastTransactions("user-1")).resolves.toEqual([{ transactionId: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be", date: "2026-09-04", amount: 245.5, category: "Essentials", transactionType: "expense", description: "Market" }]);
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining("t.user_id = ? AND t.deleted = 0 AND t.status = 'posted'"), "user-1");
    expect(getAllAsync.mock.calls[0]![0]).toContain("t.transaction_type IN ('income', 'expense')");
    expect(getAllAsync.mock.calls[0]![0]).toContain("category_groups g");
  });

  it("does not send malformed or zero-value local rows", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([{ id: "bad", transaction_date: "2026-09-04", amount_centavos: 0, transaction_type: "expense", merchant_name: null, counterparty_name: null, notes: null, category_group_label: null }]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { _resetDbCacheForTesting, listForecastTransactions } = await import("../forecastTransactions");
    _resetDbCacheForTesting();
    await expect(listForecastTransactions("user-1")).resolves.toEqual([]);
  });
});
