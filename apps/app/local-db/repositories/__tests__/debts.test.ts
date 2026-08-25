export {};

const mockInitDatabase = jest.fn();
const mockEnqueueOperation = jest.fn();
const mockRandomUUID = jest.fn();
const mockCreateExpenseInTransaction = jest.fn();
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => any };

jest.mock("../../client", () => ({ initDatabase: (...args: unknown[]) => mockInitDatabase(...args) }));
jest.mock("../../helpers", () => {
  const actual = jest.requireActual("../../helpers");
  return { ...actual, enqueueOperation: (...args: unknown[]) => mockEnqueueOperation(...args) };
});
jest.mock("../../uuid", () => ({ randomUUID: (...args: unknown[]) => mockRandomUUID(...args) }));
jest.mock("../ledger", () => ({ createExpenseInTransaction: (...args: unknown[]) => mockCreateExpenseInTransaction(...args) }));

const input = {
  name: "BPI card", lenderName: "BPI", presetKey: "credit_card", originalBalanceMinor: 10000,
  currentBalanceMinor: 9000, annualInterestRateBps: 2400, minimumPaymentMinor: 500,
  paymentFrequency: "monthly", nextDueDate: "2026-09-01", maturityDate: null,
   targetPayoffDate: null, interestPeriod: "monthly", interestMethod: "simple",
   presetData: { statementDay: 15 }, paymentSchedule: { intervalCount: "1", dayOfMonth: "", secondDayOfMonth: "", dayOfWeek: null, secondDayOfWeek: null, monthOfYear: null }, notes: null,
};

function db(getFirstAsync = jest.fn(), getAllAsync = jest.fn()) {
  return { getFirstAsync, getAllAsync, runAsync: jest.fn(), withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()) };
}

const row = { id: "debt-1", user_id: "user-1", name: "BPI card", lender_name: "BPI", preset_key: "future_preset", version: 1, status: "active", original_balance_centavos: 10000, current_balance_centavos: 9000, annual_interest_rate_bps: 2400, minimum_payment_centavos: 500, payment_frequency: "monthly", next_due_date: "2026-09-01", maturity_date: null, target_payoff_date: null, interest_period: "monthly", interest_method: "simple", preset_data: '{"statementDay":15}', notes: null };

describe("debt repository", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset().mockResolvedValue({ operation_id: "operation-1" });
    mockRandomUUID.mockReset().mockReturnValue("debt-1");
    mockCreateExpenseInTransaction.mockReset();
  });

  test("keeps unknown preset rows readable and supports all initial preset keys", async () => {
    const { DEBT_PRESETS, getDebtPreset, validatePresetData } = await import("../../../features/debt-manager/presets");
    expect(DEBT_PRESETS.map(({ key }) => key)).toEqual([
      "credit_card", "personal_salary_loan", "auto_loan", "housing_loan", "informal_loan",
      "bnpl", "online_lending_app", "product_installment", "government_member_loan", "microfinance_loan",
    ]);
    expect(getDebtPreset("removed_preset").label).toBe("Unknown preset");
    expect(() => validatePresetData("removed_preset", { termMonths: "not-a-number" })).not.toThrow();
     expect(() => validatePresetData("personal_salary_loan", { termMonths: "not-a-number" })).toThrow();
     expect(() => validatePresetData("credit_card", { termMonths: 12 })).toThrow();
     DEBT_PRESETS.push({ key: "temporary_preset", label: "Temporary", fields: [] });
    expect(getDebtPreset("temporary_preset").label).toBe("Temporary");
    DEBT_PRESETS.pop();
    expect(getDebtPreset("temporary_preset").label).toBe("Unknown preset");
  });

  test("creates, updates, and enqueues a debt inside local transactions", async () => {
    const getFirstAsync = jest.fn(async (sql: string) => sql.includes("version") ? { version: 1 } : row);
    const database = db(getFirstAsync);
    mockInitDatabase.mockResolvedValue(database);
    const { createDebt, updateDebt } = await import("../debts");

    await expect(createDebt("user-1", "device-1", input)).resolves.toMatchObject({ debt: { presetKey: "future_preset" } });
    await updateDebt("user-1", "device-1", "debt-1", { ...input, name: "Updated card" });

    expect(database.withTransactionAsync).toHaveBeenCalledTimes(2);
    expect(mockEnqueueOperation).toHaveBeenCalledWith(database, expect.objectContaining({ entity: "debt_accounts", operationType: "create" }));
    expect(mockEnqueueOperation).toHaveBeenCalledWith(database, expect.objectContaining({ entity: "debt_accounts", operationType: "update", baseVersion: 1, changedFields: expect.arrayContaining(["name", "current_balance_centavos"]) }));
  });

  test("requires confirmation and preserves a local tombstone on delete", async () => {
    const database = db(jest.fn(async () => ({ version: 3 })));
    mockInitDatabase.mockResolvedValue(database);
    const { deleteDebt } = await import("../debts");

    await expect(deleteDebt("user-1", "device-1", "debt-1", false)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(deleteDebt("user-1", "device-1", "debt-1", true)).resolves.toMatchObject({ operation: { operation_id: "operation-1" } });
    expect(database.runAsync).toHaveBeenCalledWith(expect.stringContaining("status='deleted'"), expect.any(String), "user-1", "debt-1");
    expect(mockEnqueueOperation).toHaveBeenCalledWith(database, expect.objectContaining({ entity: "debt_accounts", operationType: "delete", baseVersion: 3 }));
  });

  test("keeps malformed preset data readable and queues status changes", async () => {
    const database = db(jest.fn(async (sql: string) => sql.includes("version") ? { version: 2 } : { ...row, preset_data: "not-json", status: "archived" }));
    mockInitDatabase.mockResolvedValue(database);
    const { getDebt, updateDebtStatus } = await import("../debts");

    await expect(getDebt("user-1", "debt-1")).resolves.toMatchObject({ presetData: {}, status: "archived" });
    await updateDebtStatus("user-1", "device-1", "debt-1", "active");
    expect(mockEnqueueOperation).toHaveBeenCalledWith(database, expect.objectContaining({ changedFields: ["status"], payload: expect.objectContaining({ status: "active" }), baseVersion: 2 }));
  });

  test("creates a linked payment, updates the debt balance, and queues payment sync", async () => {
    const database = db(jest.fn(async () => row));
    mockInitDatabase.mockResolvedValue(database);
    database.runAsync.mockResolvedValue({ changes: 1 } as never);
    mockRandomUUID.mockReturnValue("payment-1");
    mockCreateExpenseInTransaction.mockResolvedValue({ transaction: { id: "transaction-1" }, operation: { operation_id: "transaction-operation" } });
    const { createDebtPaymentExpense } = await import("../debts");

    await createDebtPaymentExpense("user-1", "device-1", "debt-1", { amountMinor: 1000, sourceAccountId: "account-1", paymentDate: "2026-08-21", subcategoryId: "debt-subcategory" });

    expect(mockCreateExpenseInTransaction).toHaveBeenCalledWith(database, "user-1", "device-1", expect.objectContaining({ amount_centavos: 1000, source_account_id: "account-1" }));
    expect(database.runAsync).not.toHaveBeenCalledWith("DELETE FROM sync_queue WHERE operation_id = ?", "transaction-operation");
    expect(database.runAsync).toHaveBeenCalledWith(expect.stringContaining("UPDATE debt_accounts SET current_balance_centavos"), 1000, 1000, expect.any(String), "user-1", "debt-1", 1000);
    expect(mockEnqueueOperation).toHaveBeenCalledWith(database, expect.objectContaining({ entity: "debt_payments", operationType: "create", payload: expect.objectContaining({ source: "transaction", transaction_id: "transaction-1" }) }));
  });

  test("rejects invalid payment dates before writing any linked records", async () => {
    const database = db(jest.fn(async () => row));
    mockInitDatabase.mockResolvedValue(database);
    const { createDebtPaymentExpense } = await import("../debts");

    await expect(createDebtPaymentExpense("user-1", "device-1", "debt-1", { amountMinor: 1000, sourceAccountId: "account-1", paymentDate: "2026-02-31", subcategoryId: "debt-subcategory" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mockCreateExpenseInTransaction).not.toHaveBeenCalled();
  });

  test("rolls back the linked payment through a real SQLite transaction", async () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec("CREATE TABLE debt_accounts (id TEXT PRIMARY KEY, current_balance_centavos INTEGER NOT NULL, status TEXT, updated_at TEXT, version INTEGER, user_id TEXT, deleted INTEGER); CREATE TABLE debt_payments (id TEXT PRIMARY KEY, debt_account_id TEXT, user_id TEXT, transaction_id TEXT, source TEXT, payment_date TEXT, amount_centavos INTEGER, principal_centavos INTEGER, created_at TEXT, updated_at TEXT); CREATE TABLE transactions (id TEXT PRIMARY KEY, amount_centavos INTEGER NOT NULL);");
    sqlite.prepare("INSERT INTO debt_accounts (id, current_balance_centavos) VALUES (?, ?)").run("debt-1", 500);
    const database = {
      getFirstAsync: jest.fn(async () => ({ ...row, current_balance_centavos: 9000 })),
      getAllAsync: jest.fn(async () => []),
      runAsync: jest.fn(async (sql: string, ...args: unknown[]) => ({ changes: Number(sql.startsWith("UPDATE") ? sqlite.prepare(sql).run(...args).changes : (sqlite.prepare(sql).run(...args), 1)) })),
      withTransactionAsync: jest.fn(async (work: () => Promise<void>) => { sqlite.exec("BEGIN"); try { await work(); sqlite.exec("COMMIT"); } catch (error) { sqlite.exec("ROLLBACK"); throw error; } }),
    };
    mockInitDatabase.mockResolvedValue(database);
    mockRandomUUID.mockReturnValue("payment-1");
    mockCreateExpenseInTransaction.mockImplementation(async (db: typeof database) => {
      await db.runAsync("INSERT INTO transactions VALUES (?, ?)", "transaction-1", 1000);
      return { transaction: { id: "transaction-1" }, operation: { operation_id: "transaction-operation" } };
    });
    const { createDebtPaymentExpense } = await import("../debts");

    await expect(createDebtPaymentExpense("user-1", "device-1", "debt-1", { amountMinor: 1000, sourceAccountId: "account-1", paymentDate: "2026-08-21", subcategoryId: "debt-subcategory" })).rejects.toThrow("Payment exceeds the current debt balance");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM transactions").get().count).toBe(0);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM debt_payments").get().count).toBe(0);
    expect(sqlite.prepare("SELECT current_balance_centavos FROM debt_accounts").get().current_balance_centavos).toBe(500);
    sqlite.close();
  });

  test("bulk inserts ordered debt priorities", async () => {
    const database = db(jest.fn(), jest.fn(async () => [{ id: "debt-1" }, { id: "debt-2" }, { id: "debt-3" }]));
    mockInitDatabase.mockResolvedValue(database);
    const { setDebtPriorities } = await import("../debts");

    await setDebtPriorities("user-1", "device-1", ["debt-1", "debt-2", "debt-3"]);

    const inserts = database.runAsync.mock.calls.filter(([sql]) => String(sql).startsWith("INSERT INTO user_debt_priorities"));
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.[0]).toContain("(?,?,?,?,?,?),(?,?,?,?,?,?),(?,?,?,?,?,?)");
    expect(inserts[0]).toEqual(expect.arrayContaining(["user-1", "debt-1", 1, "debt-2", 2, "debt-3", 3]));
  });
});
