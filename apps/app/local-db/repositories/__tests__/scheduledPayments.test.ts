import { jest } from "@jest/globals";
import scheduledPaymentTables from "../../migrations/078_scheduled_payments";
import { createSqliteHarness } from "./sqliteHarness";
import type { ScheduledPaymentInput } from "../scheduledPayments";

const mockInitDatabase = jest.fn<() => Promise<unknown>>();
jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));

const meralco: ScheduledPaymentInput = {
  name: " Meralco ", subcategoryId: "sub-electricity", sourceAccountId: "acct-bpi", amountCentavos: 234_000,
  frequency: "monthly", dueDayOfMonth: 5, dueSecondDayOfMonth: 20, dueDayOfWeek: 3, dueMonth: 7,
  startsOn: "2026-09-01", endsOn: null, autoPost: false, isFamilySupport: false, isDependentSupport: false, protectedByDefault: true, notes: "  ",
};

let harness: ReturnType<typeof createSqliteHarness>;

async function repo() {
  return import("../scheduledPayments");
}

beforeEach(async () => {
  jest.resetModules();
  harness = createSqliteHarness();
  await harness.migrate(scheduledPaymentTables);
  harness.sqlite.exec(`
    CREATE TABLE subcategories (id text primary key, user_id text, kind text, is_active integer, deleted integer);
    CREATE TABLE financial_accounts (id text primary key, user_id text, status text, deleted integer);
    INSERT INTO subcategories VALUES ('sub-electricity', 'user-1', 'expense', 1, 0), ('sub-salary', 'user-1', 'income', 1, 0);
    INSERT INTO financial_accounts VALUES ('acct-bpi', 'user-1', 'active', 0), ('acct-closed', 'user-1', 'archived', 0);
  `);
  mockInitDatabase.mockResolvedValue(harness.db);
});

afterEach(() => harness.sqlite.close());

describe("createScheduledPayment", () => {
  it("stores the payment, keeps only the due fields its frequency uses, and queues the create", async () => {
    const { createScheduledPayment } = await repo();
    const created = await createScheduledPayment("user-1", "device-1", meralco, "2026-10-17");

    expect(created).toMatchObject({ name: "Meralco", dueDayOfMonth: 5, dueSecondDayOfMonth: null, dueDayOfWeek: null, dueMonth: null, notes: null, status: "active", autoPostFrom: null });
    const [operation] = harness.queued("scheduled_payments");
    expect(operation).toMatchObject({ record_id: created.id, operation_type: "create" });
    expect(operation!.payload).toMatchObject({ name: "Meralco", amount_centavos: 234_000, auto_post: false, due_day_of_week: null, auto_post_from: null });
  });

  it("starts auto-post from today", async () => {
    const { createScheduledPayment } = await repo();
    expect(await createScheduledPayment("user-1", "device-1", { ...meralco, autoPost: true }, "2026-10-17")).toMatchObject({ autoPost: true, autoPostFrom: "2026-10-17" });
  });

  it("never auto-posts a one-time payment", async () => {
    const { createScheduledPayment } = await repo();
    expect(await createScheduledPayment("user-1", "device-1", { ...meralco, frequency: "once", autoPost: true })).toMatchObject({ autoPost: false, autoPostFrom: null });
  });

  it("rejects invalid fields, income categories, and inactive accounts without writing", async () => {
    const { createScheduledPayment } = await repo();
    await expect(createScheduledPayment("user-1", "device-1", { ...meralco, dueDayOfMonth: 45 })).rejects.toThrow("Due day must be 1-31.");
    await expect(createScheduledPayment("user-1", "device-1", { ...meralco, frequency: "semi_monthly", dueSecondDayOfMonth: 5 })).rejects.toThrow("differ from the first");
    await expect(createScheduledPayment("user-1", "device-1", { ...meralco, subcategoryId: "sub-salary" })).rejects.toThrow("Select an active expense category.");
    await expect(createScheduledPayment("user-1", "device-1", { ...meralco, sourceAccountId: "acct-closed" })).rejects.toThrow("Select an active account to pay from.");
    expect(harness.sqlite.prepare("SELECT COUNT(*) AS count FROM scheduled_payments").get()).toEqual({ count: 0 });
    expect(harness.queued("scheduled_payments")).toEqual([]);
  });
});

describe("updating a scheduled payment", () => {
  it("queues only the fields that changed", async () => {
    const { createScheduledPayment, updateScheduledPayment } = await repo();
    const created = await createScheduledPayment("user-1", "device-1", meralco);
    await updateScheduledPayment("user-1", "device-1", created.id, { ...meralco, amountCentavos: 248_000 });

    expect(harness.queued("scheduled_payments")[1]).toMatchObject({ operation_type: "update", changed_fields: ["amount_centavos"], payload: { amount_centavos: 248_000 } });
  });

  it("sets auto_post_from when auto-post is switched on", async () => {
    const { createScheduledPayment, setScheduledPaymentAutoPost } = await repo();
    const created = await createScheduledPayment("user-1", "device-1", meralco);
    expect(await setScheduledPaymentAutoPost("user-1", "device-1", created.id, true, "2026-10-20")).toMatchObject({ autoPost: true, autoPostFrom: "2026-10-20" });
    expect(harness.queued("scheduled_payments")[1]!.payload).toEqual({ auto_post: true, auto_post_from: "2026-10-20" });
  });

  it("archiving stops auto-post and blocks edits until restored", async () => {
    const { createScheduledPayment, setScheduledPaymentArchived, updateScheduledPayment, getScheduledPayment } = await repo();
    const created = await createScheduledPayment("user-1", "device-1", { ...meralco, autoPost: true });
    await setScheduledPaymentArchived("user-1", "device-1", created.id, true);

    expect(await getScheduledPayment("user-1", created.id)).toMatchObject({ status: "archived", autoPost: false });
    await expect(updateScheduledPayment("user-1", "device-1", created.id, meralco)).rejects.toThrow("Restore this scheduled payment before editing it.");
    await setScheduledPaymentArchived("user-1", "device-1", created.id, false);
    expect(await getScheduledPayment("user-1", created.id)).toMatchObject({ status: "active" });
  });

  it("deletes softly and queues the delete", async () => {
    const { createScheduledPayment, deleteScheduledPayment, listScheduledPayments } = await repo();
    const created = await createScheduledPayment("user-1", "device-1", meralco);
    await deleteScheduledPayment("user-1", "device-1", created.id);

    expect(await listScheduledPayments("user-1")).toEqual([]);
    expect(harness.queued("scheduled_payments").at(-1)).toMatchObject({ record_id: created.id, operation_type: "delete" });
  });
});
