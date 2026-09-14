import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
const mockEnqueueOperation = jest.fn<(...args: any[]) => any>();
const mockUpdateTransaction = jest.fn<(...args: any[]) => any>();

jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));
jest.mock("../../helpers", () => ({
  LocalDbError: class LocalDbError extends Error {},
  enqueueOperation: (...args: any[]) => mockEnqueueOperation(...args),
}));
jest.mock("../ledger", () => ({ updateTransaction: (...args: any[]) => mockUpdateTransaction(...args) }));

describe("debt payment updates", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset().mockResolvedValue({ operation_id: "sync-1" });
    mockUpdateTransaction.mockReset().mockResolvedValue(undefined);
  });

  it("restores the debt balance when an edited payment is reduced", async () => {
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes("FROM debt_payments")) {
          return { id: "payment-1", debt_account_id: "debt-1", transaction_id: "transaction-1", payment_date: "2026-09-14", amount_centavos: 4_500_000, principal_centavos: 4_500_000, interest_centavos: 0, notes: null, version: 1 };
        }
        if (sql.includes("FROM debt_accounts")) return { current_balance_centavos: 1_500_000 };
        return null;
      }),
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { updateTransactionDebtPayment } = await import("../debtPayments");
    await updateTransactionDebtPayment("user-1", "device-1", "payment-1", {
      amount_centavos: 2_500_000,
      principal_centavos: 2_500_000,
      interest_centavos: 0,
      source_account_id: "account-1",
      subcategory_id: "subcategory-1",
      transaction_date: "2026-09-14",
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE debt_accounts SET current_balance_centavos = ?"),
      3_500_000,
      3_500_000,
      3_500_000,
      expect.any(String),
      expect.any(String),
      "debt-1",
      "user-1",
    );
  });
});
