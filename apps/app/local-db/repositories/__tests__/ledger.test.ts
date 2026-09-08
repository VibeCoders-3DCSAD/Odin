import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
const mockEnqueueOperation = jest.fn<(...args: any[]) => any>();
const mockEnsureCurrentCreditCardCycles = jest.fn<(...args: any[]) => any>();
const mockRandomUUID = jest.fn(() => "transaction-1");

jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));
jest.mock("../../helpers", () => ({
  LocalDbError: class LocalDbError extends Error {},
  enqueueOperation: (...args: any[]) => mockEnqueueOperation(...args),
}));
jest.mock("../../uuid", () => ({ randomUUID: () => mockRandomUUID() }));
jest.mock("../creditCardCycles", () => ({
  ensureCurrentCreditCardCycles: (...args: any[]) => mockEnsureCurrentCreditCardCycles(...args),
}));

describe("credit-card expense inserts", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset().mockResolvedValue({ operation_id: "sync-1" });
    mockEnsureCurrentCreditCardCycles.mockReset();
  });

  test("binds every transaction column when creating an expense", async () => {
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes("kind = 'credit_card'")) return { id: "account-1" };
        if (sql.includes("FROM credit_card_cycles")) return { id: "cycle-1" };
        if (sql.includes("FROM subcategories")) return { id: "subcategory-1" };
        if (sql.includes("FROM transactions")) return {
          id: "transaction-1", transaction_type: "expense", status: "posted", entry_source: "manual",
          transaction_date: "2026-09-07", posted_at: null, credit_card_posting_date: null,
          amount_centavos: 1000, subcategory_id: "subcategory-1", source_account_id: "account-1",
          destination_account_id: null, recurring_template_id: null, merchant_name: null,
          counterparty_name: null, notes: null, client_mutation_id: null,
        };
        return { id: "account-1" };
      }),
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (work: (tx: unknown) => Promise<void>) => work(db)),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { createExpense } = await import("../ledger");
    await createExpense("user-1", "device-1", {
      amount_centavos: 1000,
      source_account_id: "account-1",
      subcategory_id: "subcategory-1",
      transaction_date: "2026-09-07",
      client_mutation_id: "mutation-1",
    });

    const runCalls = db.runAsync.mock.calls as unknown[][];
    const insert = runCalls.find(([sql]) => String(sql).includes("INSERT INTO transactions"));
    const sql = String(insert?.[0]);
    const columns = sql.match(/\(([^)]+)\)\s*VALUES/)?.[1]?.split(",").length;
    const values = sql.match(/VALUES\s*\(([^)]+)\)/)?.[1]?.split(",").length;
    expect(values).toBe(columns);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET available_credit_centavos = COALESCE(available_credit_centavos, credit_limit_centavos) - ?"),
      1000,
      expect.any(String),
      "account-1",
      "user-1",
    );

    const creditUpdate = runCalls.find(([sql]) => String(sql).includes("SET available_credit_centavos"));
    expect(creditUpdate?.[0]).not.toContain("available_credit_centavos, credit_limit_centavos) >= ?");
  });

  test("creates an installment before its linked credit-card relationship", async () => {
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes("kind = 'credit_card'")) return { id: "account-1" };
        if (sql.includes("FROM credit_card_cycles")) return { id: "cycle-1" };
        if (sql.includes("FROM subcategories")) return { id: "subcategory-1" };
        if (sql.includes("FROM transactions")) return {
          id: "transaction-1", transaction_type: "expense", status: "posted", entry_source: "manual",
          transaction_date: "2026-09-07", posted_at: null, credit_card_posting_date: null,
          amount_centavos: 120000, subcategory_id: "subcategory-1", source_account_id: "account-1",
          destination_account_id: null, recurring_template_id: null, merchant_name: "Laptop",
          counterparty_name: null, notes: null, client_mutation_id: null,
        };
        if (sql.includes("FROM credit_card_installments")) return {
          id: "installment-1", user_id: "user-1", account_id: "account-1", transaction_id: "transaction-1",
          description: "Laptop", original_principal_centavos: 120000, remaining_principal_centavos: 120000,
          term_months: 12, remaining_months: 12, monthly_amortization_centavos: 10000,
          interest_rate_bps: 0, interest_type: "zero_interest", settlement_status: "active", version: 1,
          deleted: 0, created_at: "now", updated_at: "now",
        };
        return { id: "account-1" };
      }),
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (work: (tx: unknown) => Promise<void>) => work(db)),
    };
    mockRandomUUID.mockImplementationOnce(() => "transaction-1").mockImplementationOnce(() => "installment-1");
    mockInitDatabase.mockResolvedValue(db);

    const { createExpense } = await import("../ledger");
    await createExpense("user-1", "device-1", {
      amount_centavos: 120000, source_account_id: "account-1", subcategory_id: "subcategory-1", transaction_date: "2026-09-07",
      merchant_name: "Laptop",
      installment: {
        description: "Laptop", original_principal_centavos: 120000, remaining_principal_centavos: 120000,
        term_months: 12, remaining_months: 12, monthly_amortization_centavos: 10000,
        interest_type: "zero_interest", settlement_status: "active",
      },
    });

    const runCalls = db.runAsync.mock.calls as unknown[][];
    const insertIndex = runCalls.findIndex(([sql]) => String(sql).includes("INSERT INTO credit_card_installments"));
    const relationshipIndex = runCalls.findIndex(([sql]) => String(sql).includes("INSERT INTO credit_card_transactions"));
    expect(insertIndex).toBeGreaterThan(-1);
    expect(relationshipIndex).toBeGreaterThan(insertIndex);
    expect(runCalls[relationshipIndex]?.[1]).toBe("transaction-1");
    expect(runCalls[relationshipIndex]?.[5]).toBe("installment");
    expect(mockEnqueueOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ entity: "credit_card_installments" }));
    expect(mockEnqueueOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      entity: "credit_card_transactions", payload: expect.objectContaining({ purchase_type: "installment", installment_id: "installment-1" }),
    }));
  });

  test("moves a credit-card purchase to the cycle containing its edited date", async () => {
    const transaction = {
      id: "transaction-1", transaction_type: "expense", status: "posted", entry_source: "manual",
      transaction_date: "2026-09-07", posted_at: null, credit_card_posting_date: null,
      amount_centavos: 1000, subcategory_id: "subcategory-1", source_account_id: "account-1",
      destination_account_id: null, recurring_template_id: null, merchant_name: null,
      counterparty_name: null, notes: null, client_mutation_id: null, version: 1,
    };
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes("FROM credit_card_payments")) return null;
        if (sql.includes("FROM credit_card_transactions")) return { account_id: "account-1", cycle_id: "cycle-september", version: 1 };
        if (sql.includes("FROM credit_card_cycles")) return { id: "cycle-august" };
        if (sql.includes("FROM transactions")) return transaction;
        return { id: "account-1" };
      }),
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (work: (tx: unknown) => Promise<void>) => work(db)),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { updateTransaction } = await import("../ledger");
    await updateTransaction("user-1", "device-1", "transaction-1", {
      transaction_date: "2026-09-01",
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE credit_card_transactions SET cycle_id = ?"),
      "cycle-august",
      expect.any(String),
      "transaction-1",
      "user-1",
    );
    expect(mockEnqueueOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      entity: "credit_card_transactions",
      recordId: "transaction-1",
      operationType: "update",
      baseVersion: 1,
      changedFields: ["cycle_id"],
      payload: { cycle_id: "cycle-august" },
    }));
  });
});
