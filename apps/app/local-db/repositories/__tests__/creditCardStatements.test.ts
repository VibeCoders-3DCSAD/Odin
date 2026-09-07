import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
const mockEnqueueOperation = jest.fn<(...args: any[]) => any>();

jest.mock("../../client", () => ({
  initDatabase: (...args: any[]) => mockInitDatabase(...args),
}));

jest.mock("../../helpers", () => {
  const actual = jest.requireActual("../../helpers") as Record<string, unknown>;
  return {
    ...actual,
    enqueueOperation: (...args: any[]) => mockEnqueueOperation(...args),
  };
});

jest.mock("../../uuid", () => ({
  randomUUID: () => "statement-1",
}));

type StatementAndCycle = {
  id: string;
  user_id: string;
  cycle_id: string;
  statement_date: string;
  statement_balance_centavos: number;
  minimum_due_centavos: number;
  finance_charge_centavos: number;
  due_date: string;
  authoritative: number;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  cycle_start: string;
  cycle_statement_date: string | null;
};

function createDbMock(existing: StatementAndCycle) {
  const db = {
    getFirstAsync: jest.fn(async (sql: string) => {
      if (sql.includes("JOIN credit_card_cycles")) return existing;
      return { ...existing, ...{ version: existing.version + 1 } };
    }),
    runAsync: jest.fn(async () => ({ changes: 1 })),
    withTransactionAsync: jest.fn(async (work: (tx: unknown) => Promise<void>) => work(db)),
  };
  return db;
}

describe("credit-card statement updates", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset().mockResolvedValue({ operation_id: "sync-1" });
  });

  test("binds every update column and enqueues a statement update", async () => {
    const existing: StatementAndCycle = {
      id: "statement-1", user_id: "user-1", cycle_id: "cycle-1",
      statement_date: "2026-02-01", statement_balance_centavos: 120000,
      minimum_due_centavos: 10000, finance_charge_centavos: 2500, due_date: "2026-02-21",
      authoritative: 1, version: 2, deleted: 0, created_at: "2026-02-01T00:00:00.000Z",
       updated_at: "2026-02-01T00:00:00.000Z", cycle_start: "2026-01-01",
       cycle_statement_date: "2026-02-01",
    };
    const db = createDbMock(existing);
    mockInitDatabase.mockResolvedValue(db);

    const { updateCreditCardStatement } = await import("../creditCardStatements");
    await updateCreditCardStatement("user-1", "device-1", "statement-1", {
      statement_date: "2026-02-02", due_date: "2026-02-22",
      statement_balance_centavos: 130000, minimum_due_centavos: 11000,
      finance_charge_centavos: 2600,
    });

    const calls = db.runAsync.mock.calls as unknown as unknown[][];
    const call = calls.find((args) => String(args[0] ?? "").includes("UPDATE credit_card_statements"));
    const sql = String(call?.[0] ?? "");
    for (const column of [
      "statement_date", "statement_balance_centavos", "minimum_due_centavos",
      "finance_charge_centavos", "due_date", "updated_at",
    ]) {
      expect(sql).toContain(`${column} = ?`);
    }

    const args = call?.slice(1) ?? [];
    expect(args).toEqual([
      "2026-02-02", 130000, 11000, 2600, "2026-02-22", expect.any(String), "statement-1", "user-1",
    ]);

    expect(mockEnqueueOperation).toHaveBeenCalledWith(db, {
      userId: "user-1", deviceId: "device-1", entity: "credit_card_statements", recordId: "statement-1",
      operationType: "update", baseVersion: 2,
      changedFields: expect.arrayContaining([
        "statement_date", "statement_balance_centavos", "minimum_due_centavos",
        "finance_charge_centavos", "due_date",
      ]),
      payload: {
        statement_date: "2026-02-02", statement_balance_centavos: 130000,
        minimum_due_centavos: 11000, finance_charge_centavos: 2600, due_date: "2026-02-22",
      },
      failureMessage: expect.any(String),
    });
  });

  test("does not enqueue a cycle update when the statement date changes", async () => {
    const existing: StatementAndCycle = {
      id: "statement-1", user_id: "user-1", cycle_id: "cycle-1",
      statement_date: "2026-02-01", statement_balance_centavos: 120000,
      minimum_due_centavos: 10000, finance_charge_centavos: 2500, due_date: "2026-02-21",
      authoritative: 1, version: 2, deleted: 0, created_at: "2026-02-01T00:00:00.000Z",
       updated_at: "2026-02-01T00:00:00.000Z", cycle_start: "2026-01-01",
       cycle_statement_date: "2026-02-01",
    };
    const db = createDbMock(existing);
    mockInitDatabase.mockResolvedValue(db);

    const { updateCreditCardStatement } = await import("../creditCardStatements");
    await updateCreditCardStatement("user-1", "device-1", "statement-1", {
      statement_date: "2026-02-03", due_date: "2026-02-21",
      statement_balance_centavos: 120000, minimum_due_centavos: 10000,
      finance_charge_centavos: 2500,
    });

    expect(mockEnqueueOperation).toHaveBeenCalledTimes(1);
  });

  test("enqueues only a statement update when the statement date is unchanged", async () => {
    const existing: StatementAndCycle = {
      id: "statement-1", user_id: "user-1", cycle_id: "cycle-1",
      statement_date: "2026-02-01", statement_balance_centavos: 120000,
      minimum_due_centavos: 10000, finance_charge_centavos: 2500, due_date: "2026-02-21",
      authoritative: 1, version: 2, deleted: 0, created_at: "2026-02-01T00:00:00.000Z",
       updated_at: "2026-02-01T00:00:00.000Z", cycle_start: "2026-01-01",
       cycle_statement_date: "2026-02-01",
    };
    const db = createDbMock(existing);
    mockInitDatabase.mockResolvedValue(db);

    const { updateCreditCardStatement } = await import("../creditCardStatements");
    await updateCreditCardStatement("user-1", "device-1", "statement-1", {
      statement_date: "2026-02-01", due_date: "2026-02-28",
      statement_balance_centavos: 120000, minimum_due_centavos: 10000,
      finance_charge_centavos: 2500,
    });

    expect(mockEnqueueOperation).toHaveBeenCalledTimes(1);
  });

  test("rejects an update on the billing cycle start", async () => {
    const existing: StatementAndCycle = {
      id: "statement-1", user_id: "user-1", cycle_id: "cycle-1",
      statement_date: "2026-02-01", statement_balance_centavos: 120000,
      minimum_due_centavos: 10000, finance_charge_centavos: 2500, due_date: "2026-02-21",
      authoritative: 1, version: 2, deleted: 0, created_at: "2026-02-01T00:00:00.000Z",
       updated_at: "2026-02-01T00:00:00.000Z", cycle_start: "2026-01-01",
       cycle_statement_date: "2026-02-01",
    };
    const db = createDbMock(existing);
    mockInitDatabase.mockResolvedValue(db);

    const { updateCreditCardStatement } = await import("../creditCardStatements");
    await expect(updateCreditCardStatement("user-1", "device-1", "statement-1", {
       statement_date: "2026-01-01", due_date: "2026-02-21",
      statement_balance_centavos: 120000, minimum_due_centavos: 10000,
      finance_charge_centavos: 2500,
    })).rejects.toThrow("Statement date must be after the billing cycle start and no later than today.");
  });

  test("rejects a minimum due that exceeds the statement balance", async () => {
    const { updateCreditCardStatement } = await import("../creditCardStatements");
    await expect(updateCreditCardStatement("user-1", "device-1", "statement-1", {
      statement_date: "2026-02-01", due_date: "2026-02-21",
      statement_balance_centavos: 1000, minimum_due_centavos: 1001,
      finance_charge_centavos: 0,
    })).rejects.toThrow("Minimum amount due cannot exceed the statement balance.");
  });
});
