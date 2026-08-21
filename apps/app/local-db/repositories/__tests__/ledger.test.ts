const mockInitDatabase = jest.fn();

jest.mock("../../client", () => ({
  initDatabase: (...args: unknown[]) => mockInitDatabase(...args),
}));

jest.mock("../../uuid", () => ({
  randomUUID: jest.fn(() => "transaction-1"),
}));

describe("ledger taxonomy validation", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("allows system expense subcategories selected by the transaction form", async () => {
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes("financial_accounts")) return { id: "account-1" };
        if (sql.includes("subcategories")) return { id: "subcategory-1" };
        return {
          id: "transaction-1",
          user_id: "user-1",
          transaction_type: "expense",
          status: "posted",
          entry_source: "manual",
          transaction_date: "2026-08-14",
          posted_at: "2026-08-14T00:00:00.000Z",
          amount_centavos: 1000,
          subcategory_id: "subcategory-1",
          source_account_id: "account-1",
          destination_account_id: null,
          recurring_template_id: null,
          merchant_name: null,
          counterparty_name: null,
          notes: null,
          client_mutation_id: null,
        };
      }),
      runAsync: jest.fn(),
      withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { createExpense } = await import("../ledger");

    await expect(createExpense("user-1", "device-1", {
      amount_centavos: 1000,
      source_account_id: "account-1",
      subcategory_id: "subcategory-1",
      transaction_date: "2026-08-14",
    })).resolves.toMatchObject({ transaction: { subcategory_id: "subcategory-1" } });

    expect(db.getFirstAsync.mock.calls.find(([sql]) => sql.includes("FROM subcategories"))?.[0])
      .toContain("user_id = ? OR is_system = 1");
  });

  test("rejects edits to transactions linked to debt payments", async () => {
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes("FROM debt_payments")) return { id: "payment-1" };
        return { id: "transaction-1", user_id: "user-1", transaction_type: "expense", status: "posted", version: 1 };
      }),
      runAsync: jest.fn(),
      withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { updateTransaction } = await import("../ledger");

    await expect(updateTransaction("user-1", "device-1", "transaction-1", { notes: "changed" }))
      .rejects.toThrow("Linked debt payments must be changed from Debt Manager");
  });
});
