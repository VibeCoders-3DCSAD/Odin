import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();

jest.mock("../../client", () => ({
  initDatabase: (...args: any[]) => mockInitDatabase(...args),
}));

describe("credit-card statements", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
  });

  test("rejects a statement dated before its billing-cycle cutoff", async () => {
    const db = {
      getFirstAsync: jest.fn(async () => ({
        id: "cycle-1",
        cutoff_date: "2026-01-31",
        statement_date: null,
      })),
      runAsync: jest.fn(),
      withTransactionAsync: jest.fn(async (work: (tx: unknown) => Promise<void>) => work(db)),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { createCreditCardStatement } = await import("../creditCardStatements");

    await expect(createCreditCardStatement("user-1", "device-1", {
      cycle_id: "cycle-1",
      statement_date: "2026-01-30",
      due_date: "2026-02-21",
      statement_balance_centavos: 120000,
      minimum_due_centavos: 10000,
    })).rejects.toThrow("Statement date must be on or after the billing-cycle cutoff and no later than today.");

    expect(db.runAsync).not.toHaveBeenCalled();
  });
});
