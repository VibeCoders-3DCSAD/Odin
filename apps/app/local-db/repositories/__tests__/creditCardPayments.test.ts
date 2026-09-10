import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: never[]) => never>();
const mockCreateExpenseInTransaction = jest.fn<(...args: never[]) => never>();
const mockUpdateTransaction = jest.fn<(...args: never[]) => never>();
const mockDeleteTransaction = jest.fn<(...args: never[]) => never>();

jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));
jest.mock("../ledger", () => ({
  createExpenseInTransaction: (...args: never[]) => mockCreateExpenseInTransaction(...args),
  updateTransaction: (...args: never[]) => mockUpdateTransaction(...args),
  deleteTransaction: (...args: never[]) => mockDeleteTransaction(...args),
}));

function paymentRow(amountCentavos = 10_000) {
  return {
    id: "payment-1", user_id: "user-1", cycle_id: "cycle-1", statement_id: "statement-1",
    transaction_id: "transaction-1", amount_centavos: amountCentavos, payment_date: "2026-09-10",
    source_account_id: "source-1", notes: null, issuer_recognized: 0, client_mutation_id: "mutation-1",
    version: 1, deleted: 0, created_at: "2026-09-10T00:00:00.000Z", updated_at: "2026-09-10T00:00:00.000Z",
  };
}

describe("credit-card payment calculations", () => {
  const balance = 100_000;
  const minimum = 20_000;

  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockCreateExpenseInTransaction.mockReset();
    mockUpdateTransaction.mockReset();
    mockDeleteTransaction.mockReset();
  });

  test("derives partially paid below the minimum", async () => {
    const { calculateCreditCardPaymentStatus } = await import("../creditCardPayments");
    expect(calculateCreditCardPaymentStatus(19_999, balance, minimum)).toBe("partially_paid");
  });

  test("derives minimum satisfied at the minimum", async () => {
    const { calculateCreditCardPaymentStatus } = await import("../creditCardPayments");
    expect(calculateCreditCardPaymentStatus(minimum, balance, minimum)).toBe("minimum_satisfied");
  });

  test("derives fully paid at and above the balance", async () => {
    const { calculateCreditCardPaymentStatus } = await import("../creditCardPayments");
    expect(calculateCreditCardPaymentStatus(balance, balance, minimum)).toBe("fully_paid");
    expect(calculateCreditCardPaymentStatus(120_000, balance, minimum)).toBe("fully_paid");
  });

  test("retains overpayment as an unapplied credit balance", async () => {
    const { creditBalanceCentavos } = await import("../creditCardPayments");
    expect(creditBalanceCentavos(120_000, balance)).toBe(20_000);
    expect(creditBalanceCentavos(balance, balance)).toBe(0);
  });

  test("restores available credit when recording a statement payment", async () => {
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes("FROM credit_card_statements")) return { id: "statement-1", statement_balance_centavos: 20_000 };
        if (sql.includes("FROM financial_accounts")) return { id: "source-1" };
        if (sql.includes("cycle_id = ? AND deleted = 0")) return null;
        if (sql.includes("SELECT * FROM credit_card_payments")) return paymentRow();
        return null;
      }),
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
    };
    mockInitDatabase.mockResolvedValue(db as never);
    mockCreateExpenseInTransaction.mockResolvedValue({ transaction: { id: "transaction-1" } } as never);

    const { createStatementPayment } = await import("../creditCardPayments");
    await createStatementPayment("user-1", "device-1", {
      cycleId: "cycle-1", statementId: "statement-1", amount_centavos: 10_000,
      source_account_id: "source-1", subcategory_id: "subcategory-1", transaction_date: "2026-09-10",
      merchant_name: "Card payment", notes: null,
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET available_credit_centavos = MIN(credit_limit_centavos"),
      10_000, expect.any(String), "cycle-1", "user-1", "user-1",
    );
  });

  test("reconciles available credit when changing a statement payment", async () => {
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes("SELECT * FROM credit_card_payments")) return paymentRow(10_000);
        if (sql.includes("FROM credit_card_statements")) return { id: "statement-1", statement_balance_centavos: 20_000 };
        return null;
      }),
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
    };
    mockInitDatabase.mockResolvedValue(db as never);
    mockUpdateTransaction.mockResolvedValue({ transaction: { id: "transaction-1" } } as never);

    const { updateStatementPayment } = await import("../creditCardPayments");
    await updateStatementPayment("user-1", "device-1", "payment-1", {
      amount_centavos: 7_000, source_account_id: "source-1", subcategory_id: "subcategory-1",
      transaction_date: "2026-09-10", merchant_name: "Card payment", notes: null,
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("available_credit_centavos, credit_limit_centavos) + ? - ?"),
      10_000, 7_000, expect.any(String), "cycle-1", "user-1", "user-1",
    );
  });

  test("reverses available credit when deleting a statement payment", async () => {
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => sql.includes("SELECT * FROM credit_card_payments") ? paymentRow(10_000) : null),
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
    };
    mockInitDatabase.mockResolvedValue(db as never);
    mockDeleteTransaction.mockResolvedValue({ transaction: { id: "transaction-1" } } as never);

    const { deleteStatementPayment } = await import("../creditCardPayments");
    await deleteStatementPayment("user-1", "device-1", "payment-1");

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("available_credit_centavos, credit_limit_centavos) - ?"),
      10_000, expect.any(String), "cycle-1", "user-1", "user-1",
    );
  });
});
