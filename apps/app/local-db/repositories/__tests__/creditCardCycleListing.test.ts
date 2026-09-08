import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();

jest.mock("../../client", () => ({
  initDatabase: (...args: any[]) => mockInitDatabase(...args),
}));

describe("credit-card cycle listing", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
  });

  test("excludes cycles for deleted or inactive card accounts", async () => {
    const db = {
      getAllAsync: jest.fn(async () => []),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { listCreditCardCycles } = await import("../creditCardCycles");
    await listCreditCardCycles("user-1");

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("JOIN financial_accounts a ON a.id = c.account_id AND a.user_id = c.user_id"),
      "user-1",
    );
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("a.kind = 'credit_card' AND a.status = 'active' AND a.deleted = 0"),
      "user-1",
    );
  });

  test("projects only remaining installment cycles for backfilled purchases", async () => {
    const db = { getAllAsync: jest.fn(async () => []) };
    mockInitDatabase.mockResolvedValue(db);

    const { listCreditCardCycleTransactions } = await import("../creditCardCycles");
    await listCreditCardCycleTransactions("user-1");

    const sql = String((db.getAllAsync.mock.calls as unknown[][])[0]?.[0]);
    expect(sql).toContain("> (i.term_months - i.remaining_months)");
    expect(sql).toContain("<= i.term_months");
  });
});
