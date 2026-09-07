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
  randomUUID: () => "successor-cycle",
}));

type Cycle = {
  id: string;
  user_id: string;
  account_id: string;
  cycle_start_date: string;
  cutoff_date: string;
  statement_date: string | null;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
};

describe("deferred credit-card cycle generation", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset().mockResolvedValue({ operation_id: "sync-1" });
  });

  test("creates the successor only after an edited cycle has closed", async () => {
    const cycles: Cycle[] = [{
      id: "edited-cycle",
      user_id: "user-1",
      account_id: "card-1",
      cycle_start_date: "2026-09-04",
      cutoff_date: "2026-09-15",
      statement_date: null,
      version: 1,
      deleted: 0,
      created_at: "2026-09-04T00:00:00.000Z",
      updated_at: "2026-09-04T00:00:00.000Z",
    }];
    const db = {
      getAllAsync: jest.fn(async () => [{ account_id: "card-1", cutoff_day: 4, billing_cycle_days: 31 }]),
      getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        const accountId = params[1] as string;
        const date = params[2] as string;
        if (sql.includes("cycle_start_date <=")) {
          return cycles.find((cycle) => cycle.account_id === accountId && cycle.cycle_start_date <= date && cycle.cutoff_date >= date) ?? null;
        }
        if (sql.includes("cutoff_date <")) {
          return cycles.filter((cycle) => cycle.account_id === accountId && cycle.cutoff_date < date).sort((a, b) => b.cutoff_date.localeCompare(a.cutoff_date))[0] ?? null;
        }
        return null;
      }),
      runAsync: jest.fn(async (_sql: string, ...params: unknown[]) => {
        cycles.push({
          id: params[0] as string,
          user_id: params[1] as string,
          account_id: params[2] as string,
          cycle_start_date: params[3] as string,
          cutoff_date: params[4] as string,
          statement_date: null,
          version: 1,
          deleted: 0,
          created_at: params[5] as string,
          updated_at: params[6] as string,
        });
        return { changes: 1 };
      }),
      withTransactionAsync: jest.fn(async (work: (tx: unknown) => Promise<void>) => work(db)),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { ensureCurrentCreditCardCycles } = await import("../creditCardCycles");
    const ensured = await ensureCurrentCreditCardCycles("user-1", "device-1", "2026-09-16");

    expect(ensured).toMatchObject([{ cycle_start_date: "2026-09-16", cutoff_date: "2026-10-16" }]);
    expect(cycles).toHaveLength(2);
    expect(mockEnqueueOperation).toHaveBeenCalledWith(db, expect.objectContaining({
      entity: "credit_card_cycles",
      payload: expect.objectContaining({ cycle_start_date: "2026-09-16", cutoff_date: "2026-10-16" }),
    }));
  });
});
