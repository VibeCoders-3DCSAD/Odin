import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));
jest.mock("../../helpers", () => ({
  LocalDbError: class extends Error {},
  enqueueOperation: jest.fn(async () => ({ operation_id: "op-1" })),
}));
jest.mock("../ledger", () => ({
  createExpenseInTransaction: jest.fn(async () => ({ transaction: { id: "tx-1" } })),
}));
jest.mock("../../uuid", () => ({ randomUUID: jest.fn(() => "payment-1") }));

test("records card payment and all effects inside one SQLite transaction", async () => {
  const db = {
    getFirstAsync: jest.fn(async (sql: string, ..._args: unknown[]) => {
      if (sql.includes("SELECT account_id FROM credit_card_cycles")) return { account_id: "card-1" };
      if (sql.includes("SUM(amount_centavos)")) return { total: 100 };
      return { value: "cycle-1" };
    }),
    runAsync: jest.fn(async (_sql: string, ..._args: unknown[]) => ({ changes: 1 })),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
  };
  mockInitDatabase.mockResolvedValue(db);
  const { recordCreditCardPayment } = await import("../creditCards");

  await recordCreditCardPayment("user-1", "device-1", {
    cycleId: "cycle-1", statementId: null, amountMinor: 100,
    paymentDate: "2026-09-03", sourceAccountId: "cash-1", subcategoryId: "sub-1",
  });

  expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
  expect(db.runAsync.mock.calls.some(([sql]) => String(sql).includes("available_credit_centavos=MIN"))).toBe(false);
});

test("issuer recognition fails when the card detail row is missing", async () => {
  jest.resetModules();
  const db = {
    getFirstAsync: jest.fn(async (sql: string) => sql.includes("SELECT p.version")
      ? { version: 1, issuerRecognized: 0, amount: 100, accountId: "card-1", cycleId: "cycle-1" }
      : null),
    runAsync: jest.fn(async (sql: string) => ({ changes: sql.includes("credit_card_details") ? 0 : 1 })),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
  };
  mockInitDatabase.mockResolvedValue(db);
  const { recognizeCreditCardPayment } = await import("../creditCards");
  await expect(recognizeCreditCardPayment("user-1", "device-1", "payment-1"))
    .rejects.toThrow("NOT_FOUND");
});

test("uses a non-reserved alias when recording a card purchase", async () => {
  jest.resetModules();
  const db = {
    getFirstAsync: jest.fn(async (sql: string) => sql.includes("credit_card_details")
      ? { available: 5000, credit_limit: 10000 }
      : null),
    getAllAsync: jest.fn(async () => [{
      id: "cycle-1",
      cycleStartDate: "2026-09-01",
      cutoffDate: "2026-09-30",
      statementDate: "2026-10-05",
    }]),
    runAsync: jest.fn(async () => ({ changes: 1 })),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
  };
  mockInitDatabase.mockResolvedValue(db);
  const { recordCreditCardPurchase } = await import("../creditCards");

  await expect(recordCreditCardPurchase("user-1", "device-1", {
    accountId: "card-1",
    amountMinor: 100,
    transactionDate: "2026-09-03",
    subcategoryId: "sub-1",
    purchaseType: "regular",
  })).resolves.toMatchObject({ transactionId: "tx-1", cycleId: "cycle-1" });

  expect(db.getFirstAsync.mock.calls.find(([sql]) => String(sql).includes("credit_card_details"))?.[0])
    .toContain("AS credit_limit");
});

test("creates the first billing cycle from card defaults", async () => {
  jest.resetModules();
  const db = {
    getFirstAsync: jest.fn(async (sql: string) => sql.includes("credit_card_details")
      ? { available: 5000, credit_limit: 10000, default_cutoff_date: "2026-09-30", default_statement_date: "2026-10-05" }
      : null),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => ({ changes: 1 })),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
  };
  mockInitDatabase.mockResolvedValue(db);
  const { recordCreditCardPurchase } = await import("../creditCards");

  await expect(recordCreditCardPurchase("user-1", "device-1", {
    accountId: "card-1",
    amountMinor: 100,
    transactionDate: "2026-09-03",
    subcategoryId: "sub-1",
    purchaseType: "regular",
  })).resolves.toMatchObject({ transactionId: "tx-1" });

  const cycleInsert = (db.runAsync.mock.calls as unknown[][]).find((call) => String(call[0]).includes("INSERT INTO credit_card_cycles"));
  expect(cycleInsert?.[2]).toBe("user-1");
  expect(cycleInsert?.[4]).toBe("2026-09-01");
  expect(cycleInsert?.[5]).toBe("2026-09-30");
});
