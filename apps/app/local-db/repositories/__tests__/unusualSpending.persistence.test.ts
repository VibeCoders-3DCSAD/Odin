import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
const mockEnqueueOperation = jest.fn<(...args: any[]) => any>();

jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));
jest.mock("../../helpers", () => ({ enqueueOperation: (...args: any[]) => mockEnqueueOperation(...args) }));
jest.mock("../../uuid", () => ({ randomUUID: () => "evaluation-1" }));

describe("saveUnusualSpending", () => {
  beforeEach(() => { jest.resetModules(); mockInitDatabase.mockReset(); mockEnqueueOperation.mockReset(); });

  it("stores one immutable evaluation and queues it after its transaction", async () => {
    const runAsync = jest.fn<(...args: any[]) => any>();
    const getFirstAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue({ id: "evaluation-1" });
    mockInitDatabase.mockResolvedValue({
      withTransactionAsync: async (callback: () => Promise<void>) => callback(),
      runAsync,
      getFirstAsync,
    });
    const { saveUnusualSpending } = await import("../unusualSpending");

    await saveUnusualSpending("user-1", "device-1", {
      transactionId: "transaction-1", subcategoryId: "subcategory-1", amountCentavos: 100_000,
      subcategoryLabel: "Groceries", accountName: "Cash", transactionDate: "2026-10-30",
      usualSpendingCentavos: 12_500, lowerBoundCentavos: 7_500, upperBoundCentavos: 20_000,
      severity: 1.2, usableHistoryCount: 6, confirmedRecurring: false, recurrence: null, recurrenceMonths: null,
    });

    expect(runAsync.mock.calls[0]?.[0]).toContain("INSERT OR IGNORE INTO anomaly_evaluations");
    expect(mockEnqueueOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      entity: "anomaly_evaluations", recordId: "evaluation-1", operationType: "create",
      payload: expect.objectContaining({ transaction_id: "transaction-1", subcategory_id: "subcategory-1" }),
    }));
  });

  it("lists only persisted evaluations instead of recalculating transaction history", async () => {
    const getAllAsync = jest.fn<(...args: any[]) => any>().mockResolvedValue([{
      id: "transaction-1", transaction_date: "2026-10-30", amount_centavos: 100_000,
      subcategory_id: "subcategory-1", subcategory_label: "Groceries", account_name: "Cash",
      usable_history_count: 6, usual_spending_centavos: 12_500,
      lower_bound_centavos: 7_500, upper_bound_centavos: 20_000, severity: 1.2,
      recurrence: "frequent",
    }]);
    mockInitDatabase.mockResolvedValue({ getAllAsync });
    const { listPersistedUnusualSpendings } = await import("../unusualSpending");

    await expect(listPersistedUnusualSpendings("user-1")).resolves.toEqual([{
      transactionId: "transaction-1", transactionDate: "2026-10-30", amountCentavos: 100_000,
      subcategoryId: "subcategory-1", subcategoryLabel: "Groceries", accountName: "Cash",
      usableHistoryCount: 6, usualSpendingCentavos: 12_500,
      lowerBoundCentavos: 7_500, upperBoundCentavos: 20_000, severity: 1.2,
      confirmedRecurring: true, recurrence: "frequent", recurrenceMonths: null,
    }]);
    expect(getAllAsync.mock.calls[0]?.[0]).toContain("FROM anomaly_evaluations");
  });

  it("reads the months a yearly answer comes back in", async () => {
    const row = (id: string, recurrence_months: string | null) => ({
      id, transaction_date: "2026-10-30", amount_centavos: 100_000,
      subcategory_id: "subcategory-1", subcategory_label: "Tuition", account_name: "Cash",
      usable_history_count: 6, usual_spending_centavos: 12_500,
      lower_bound_centavos: 7_500, upper_bound_centavos: 20_000, severity: 1.2,
      recurrence: "yearly", recurrence_months,
    });
    mockInitDatabase.mockResolvedValue({ getAllAsync: jest.fn<(...args: any[]) => any>().mockResolvedValue([row("chosen", "[6,11]"), row("own-month", null), row("malformed", "[0]")]) });
    const { listPersistedUnusualSpendings } = await import("../unusualSpending");

    const insights = await listPersistedUnusualSpendings("user-1");
    expect(insights.map((insight) => [insight.transactionId, insight.recurrenceMonths])).toEqual([["chosen", [6, 11]], ["own-month", null], ["malformed", null]]);
  });

  it("leaves out evaluations of spending below the usual amount", async () => {
    const row = (id: string, amount_centavos: number) => ({
      id, transaction_date: "2026-10-30", amount_centavos,
      subcategory_id: "subcategory-1", subcategory_label: "Groceries", account_name: "Cash",
      usable_history_count: 6, usual_spending_centavos: 12_500,
      lower_bound_centavos: 7_500, upper_bound_centavos: 20_000, severity: 1.2, recurrence: null,
    });
    mockInitDatabase.mockResolvedValue({ getAllAsync: jest.fn<(...args: any[]) => any>().mockResolvedValue([row("higher", 100_000), row("lower", 1_000)]) });
    const { listPersistedUnusualSpendings } = await import("../unusualSpending");

    expect((await listPersistedUnusualSpendings("user-1")).map((insight) => insight.transactionId)).toEqual(["higher"]);
  });
});

describe("answerUnusualSpending", () => {
  beforeEach(() => { jest.resetModules(); mockInitDatabase.mockReset(); mockEnqueueOperation.mockReset(); });

  function unanswered(runAsync: jest.Mock<(...args: any[]) => any>) {
    mockInitDatabase.mockResolvedValue({
      withTransactionAsync: async (callback: () => Promise<void>) => callback(),
      runAsync,
      getFirstAsync: jest.fn<(...args: any[]) => any>().mockResolvedValue({ id: "evaluation-1", version: 1, recurrence: null }),
    });
  }

  it("records a frequent answer with its confirmation time and queues a versioned update", async () => {
    const runAsync = jest.fn<(...args: any[]) => any>();
    unanswered(runAsync);
    const { answerUnusualSpending } = await import("../unusualSpending");

    await answerUnusualSpending("user-1", "device-1", "transaction-1", "frequent");

    expect(runAsync.mock.calls[0]?.[0]).toContain("SET recurrence = ?, confirmed_recurring_at = ?");
    expect(runAsync.mock.calls[0]?.[1]).toBe("frequent");
    expect(runAsync.mock.calls[0]?.[2]).toEqual(expect.any(String));
    expect(mockEnqueueOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      entity: "anomaly_evaluations", recordId: "evaluation-1", operationType: "update",
      baseVersion: 1, changedFields: ["recurrence", "confirmed_recurring_at"],
      payload: { recurrence: "frequent", confirmed_recurring_at: expect.any(String) },
    }));
  });

  it("records a yearly answer without a frequent confirmation", async () => {
    const runAsync = jest.fn<(...args: any[]) => any>();
    unanswered(runAsync);
    const { answerUnusualSpending } = await import("../unusualSpending");

    await answerUnusualSpending("user-1", "device-1", "transaction-1", "yearly");

    expect(runAsync.mock.calls[0]?.slice(1, 3)).toEqual(["yearly", null]);
    expect(mockEnqueueOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      changedFields: ["recurrence"], payload: { recurrence: "yearly" },
    }));
  });

  it("records the months a yearly answer comes back in", async () => {
    const runAsync = jest.fn<(...args: any[]) => any>();
    unanswered(runAsync);
    const { answerUnusualSpending } = await import("../unusualSpending");

    await answerUnusualSpending("user-1", "device-1", "transaction-1", "yearly", [11, 6]);

    expect(runAsync.mock.calls[0]?.[0]).toContain("recurrence_months = ?");
    expect(runAsync.mock.calls[0]?.slice(1, 4)).toEqual(["yearly", null, "[6,11]"]);
    expect(mockEnqueueOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      changedFields: ["recurrence", "recurrence_months"], payload: { recurrence: "yearly", recurrence_months: [6, 11] },
    }));
  });

  it.each([
    ["one_time", [6]],
    ["yearly", []],
    ["yearly", [13]],
  ] as const)("refuses %s with months %j", async (recurrence, months) => {
    const runAsync = jest.fn<(...args: any[]) => any>();
    unanswered(runAsync);
    const { answerUnusualSpending } = await import("../unusualSpending");

    await expect(answerUnusualSpending("user-1", "device-1", "transaction-1", recurrence, months)).rejects.toThrow("recurrence months need a yearly answer");
    expect(runAsync).not.toHaveBeenCalled();
  });

  it("does not queue a second answer", async () => {
    const runAsync = jest.fn<(...args: any[]) => any>();
    mockInitDatabase.mockResolvedValue({
      withTransactionAsync: async (callback: () => Promise<void>) => callback(),
      runAsync,
      getFirstAsync: jest.fn<(...args: any[]) => any>().mockResolvedValue({ id: "evaluation-1", version: 2, recurrence: "one_time" }),
    });
    const { answerUnusualSpending } = await import("../unusualSpending");

    await answerUnusualSpending("user-1", "device-1", "transaction-1", "frequent");

    expect(runAsync).not.toHaveBeenCalled();
    expect(mockEnqueueOperation).not.toHaveBeenCalled();
  });
});
