import { jest } from "@jest/globals";
import { createSqliteHarness } from "./sqliteHarness";
import evaluations from "../../migrations/073_anomaly_evaluations";
import confirmation from "../../migrations/076_anomaly_recurring_confirmation";
import recurrence from "../../migrations/089_anomaly_spending_recurrence";
import months from "../../migrations/091_anomaly_recurrence_months";

const mockInitDatabase = jest.fn<() => Promise<unknown>>();
jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));

let harness: ReturnType<typeof createSqliteHarness>;
beforeEach(async () => {
  jest.resetModules();
  harness = createSqliteHarness();
  await harness.migrate(evaluations, confirmation, recurrence, months);
  const fixtures: [string, string][] = [["first", "user-1"], ["second", "user-1"], ["other", "user-2"]];
  for (const [id, userId] of fixtures) {
    harness.sqlite.prepare(`INSERT INTO anomaly_evaluations
      (id, user_id, transaction_id, subcategory_id, amount_centavos, usable_history_count,
       usual_spending_centavos, lower_bound_centavos, upper_bound_centavos, severity,
       model_version, evaluated_at, version, deleted, created_at, updated_at, recurrence, recurrence_months)
      VALUES (?, ?, ?, 'school', 350000, 6, 10000, 5000, 20000, 3, 'v1', 'now', 2, 0, 'now', 'now', 'yearly', '[6,11]')`).run(id, userId, `transaction-${id}`);
  }
  mockInitDatabase.mockResolvedValue(harness.db);
});
afterEach(() => harness.sqlite.close());

function answers() {
  return harness.sqlite.prepare("SELECT id, recurrence, recurrence_months, version FROM anomaly_evaluations ORDER BY id").all();
}

it("updates every grouped answer and queues its versioned sync operation", async () => {
  const { reviseRecurringPaymentGroup } = await import("../unusualSpending");
  await reviseRecurringPaymentGroup("user-1", "device-1", ["transaction-first", "transaction-second"], [11, 8]);
  expect(answers()).toEqual([
    { id: "first", recurrence: "yearly", recurrence_months: "[8,11]", version: 3 },
    { id: "other", recurrence: "yearly", recurrence_months: "[6,11]", version: 2 },
    { id: "second", recurrence: "yearly", recurrence_months: "[8,11]", version: 3 },
  ]);
  expect(harness.queued("anomaly_evaluations")).toEqual(["first", "second"].map((id) => ({
    record_id: id, operation_type: "update", changed_fields: ["recurrence", "recurrence_months"],
    payload: { recurrence: "yearly", recurrence_months: [8, 11] },
  })));
});

it("removes recurrence from every payment without deleting payment records", async () => {
  const { reviseRecurringPaymentGroup } = await import("../unusualSpending");
  await reviseRecurringPaymentGroup("user-1", "device-1", ["transaction-first", "transaction-second"], null);
  expect(answers().filter((row) => row.id !== "other")).toEqual(["first", "second"].map((id) => ({
    id, recurrence: "one_time", recurrence_months: null, version: 3,
  })));
  expect(harness.queued("anomaly_evaluations")).toHaveLength(2);
});

it("rejects a group containing another user's record without making partial changes", async () => {
  const { reviseRecurringPaymentGroup } = await import("../unusualSpending");
  const before = answers();
  await expect(reviseRecurringPaymentGroup("user-1", "device-1", ["transaction-first", "transaction-other"], [8])).rejects.toThrow("group has changed");
  expect(answers()).toEqual(before);
  expect(harness.queued("anomaly_evaluations")).toEqual([]);
});

it("rolls back every answer and sync operation if queuing fails partway through", async () => {
  const { reviseRecurringPaymentGroup } = await import("../unusualSpending");
  harness.sqlite.exec(`CREATE TRIGGER fail_second BEFORE INSERT ON sync_queue
    WHEN NEW.record_id = 'second' BEGIN SELECT RAISE(ABORT, 'queue failure'); END`);
  const before = answers();
  await expect(reviseRecurringPaymentGroup("user-1", "device-1", ["transaction-first", "transaction-second"], [8])).rejects.toThrow("queue failure");
  expect(answers()).toEqual(before);
  expect(harness.queued("anomaly_evaluations")).toEqual([]);
});
