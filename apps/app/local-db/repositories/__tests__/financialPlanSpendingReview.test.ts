import { jest } from "@jest/globals";
import { DatabaseSync } from "node:sqlite";

// Real in-memory SQLite (node:sqlite) behind the expo-sqlite async methods the repository uses.
const mockInitDatabase = jest.fn<() => Promise<unknown>>();
jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));

const SCHEMA = `
  CREATE TABLE financial_plans (id text primary key, user_id text not null, period_start text not null, period_end text not null, status text not null, deleted integer not null default 0);
  CREATE TABLE financial_plan_allocations (id text primary key, plan_id text not null, category_id text, subcategory_id text, allocation_rule text not null, allocated_amount_centavos integer not null);
  CREATE TABLE subcategories (id text primary key, user_id text not null, category_id text, is_system integer not null default 1, deleted integer not null default 0);
  CREATE TABLE transactions (id text primary key, user_id text not null, transaction_type text not null, status text not null, transaction_date text not null, amount_centavos integer not null, subcategory_id text, category_id text, source_savings_goal_id text, destination_savings_goal_id text, deleted integer not null default 0, recurring_template_id text);
  CREATE TABLE debt_payments (id text primary key, user_id text not null, transaction_id text, deleted integer not null default 0);
  CREATE TABLE credit_card_payments (id text primary key, user_id text not null, transaction_id text, deleted integer not null default 0);
  CREATE TABLE scheduled_payment_records (id text primary key, user_id text not null, transaction_id text, deleted integer not null default 0);
`;

type Tx = { id: string; amount: number; sub?: string | null; user?: string; type?: string; status?: string; date?: string; deleted?: number; category?: string | null; sourceGoal?: string | null; destinationGoal?: string | null; template?: string | null };

let sqlite: DatabaseSync;

function insertTx(tx: Tx) {
  sqlite.prepare("INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    tx.id, tx.user ?? "user-1", tx.type ?? "expense", tx.status ?? "posted", tx.date ?? "2026-09-15", tx.amount,
    tx.sub ?? null, tx.category ?? null, tx.sourceGoal ?? null, tx.destinationGoal ?? null, tx.deleted ?? 0, tx.template ?? null,
  );
}

async function review(userId = "user-1", planId = "plan-1") {
  const { getPlanSpendingReview } = await import("../financialPlanSpendingReview");
  return getPlanSpendingReview(userId, planId);
}

describe("getPlanSpendingReview", () => {
  beforeEach(() => {
    jest.resetModules();
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(SCHEMA);
    sqlite.exec(`
      INSERT INTO financial_plans VALUES ('plan-1', 'user-1', '2026-09-01', '2026-09-30', 'accepted', 0);
      INSERT INTO financial_plan_allocations VALUES ('alloc-food', 'plan-1', 'cat-food', NULL, 'FLEXIBLE', 10000);
      INSERT INTO financial_plan_allocations VALUES ('alloc-rent', 'plan-1', NULL, 'sub-rent', 'FIXED', 50000);
      INSERT INTO subcategories VALUES ('sub-groceries', 'user-1', 'cat-food', 1, 0);
      INSERT INTO subcategories VALUES ('sub-dining', 'user-1', 'cat-food', 1, 0);
      INSERT INTO subcategories VALUES ('sub-rent', 'user-1', 'cat-housing', 1, 0);
      INSERT INTO subcategories VALUES ('sub-utilities', 'user-1', 'cat-housing', 1, 0);
      INSERT INTO subcategories VALUES ('sub-fun', 'user-1', 'cat-leisure', 1, 0);
    `);
    mockInitDatabase.mockResolvedValue({
      getFirstAsync: async (sql: string, ...params: any[]) => sqlite.prepare(sql).get(...params) ?? null,
      getAllAsync: async (sql: string, ...params: any[]) => sqlite.prepare(sql).all(...params),
    });
  });

  afterEach(() => sqlite.close());

  it("rolls subcategory spending up to a broad-category allocation and matches subcategory allocations exactly", async () => {
    insertTx({ id: "t1", amount: 4000, sub: "sub-groceries" });
    insertTx({ id: "t2", amount: 3000, sub: "sub-dining" });
    insertTx({ id: "t3", amount: 50000, sub: "sub-rent" });
    insertTx({ id: "t4", amount: 2000, sub: null, category: "cat-food" });

    const result = await review();

    expect(result?.rows).toEqual([
      { allocationId: "alloc-food", categoryId: "cat-food", subcategoryId: null, allocationRule: "FLEXIBLE", plannedCentavos: 10000, actualCentavos: 9000, varianceCentavos: 1000, exceeded: false },
      { allocationId: "alloc-rent", categoryId: null, subcategoryId: "sub-rent", allocationRule: "FIXED", plannedCentavos: 50000, actualCentavos: 50000, varianceCentavos: 0, exceeded: false },
    ]);
    expect(result).toMatchObject({ planId: "plan-1", periodStart: "2026-09-01", periodEnd: "2026-09-30", unplannedActualCentavos: 0, plannedTotalCentavos: 60000, actualTotalCentavos: 59000, exceeded: false });
  });

  it("puts spending with no matching allocation in the unplanned bucket and counts it toward the total", async () => {
    insertTx({ id: "t1", amount: 5000, sub: "sub-utilities" });
    insertTx({ id: "t2", amount: 7000, sub: "sub-fun" });
    insertTx({ id: "t3", amount: 1000, sub: "sub-groceries" });

    const result = await review();

    expect(result?.unplannedActualCentavos).toBe(12000);
    expect(result?.actualTotalCentavos).toBe(13000);
    expect(result?.rows.map((row) => row.actualCentavos)).toEqual([1000, 0]);
  });

  it("excludes debt payments, credit-card payments and savings transfers but keeps payments whose link was deleted", async () => {
    insertTx({ id: "debt", amount: 8000, sub: "sub-groceries" });
    insertTx({ id: "card", amount: 9000, sub: "sub-groceries" });
    insertTx({ id: "to-goal", amount: 6000, sub: "sub-groceries", destinationGoal: "goal-1" });
    insertTx({ id: "from-goal", amount: 6000, sub: "sub-groceries", sourceGoal: "goal-1" });
    insertTx({ id: "unlinked", amount: 1500, sub: "sub-groceries" });
    sqlite.exec(`
      INSERT INTO debt_payments VALUES ('dp-1', 'user-1', 'debt', 0);
      INSERT INTO credit_card_payments VALUES ('cp-1', 'user-1', 'card', 0);
      INSERT INTO debt_payments VALUES ('dp-2', 'user-1', 'unlinked', 1);
    `);

    const result = await review();

    expect(result?.rows[0]?.actualCentavos).toBe(1500);
    expect(result?.actualTotalCentavos).toBe(1500);
  });

  it("excludes scheduled payment transactions but counts them again once their payment record is deleted", async () => {
    sqlite.exec(`
      INSERT INTO scheduled_payment_records VALUES ('rec-rent', 'user-1', 'rent', 0);
      INSERT INTO scheduled_payment_records VALUES ('rec-old', 'user-1', 'old-bill', 1);
      INSERT INTO scheduled_payment_records VALUES ('rec-other-user', 'user-2', 'gym', 0);
    `);
    insertTx({ id: "rent", amount: 50000, sub: "sub-rent" });
    insertTx({ id: "old-bill", amount: 1000, sub: "sub-groceries" });
    insertTx({ id: "gym", amount: 700, sub: "sub-fun" });
    const result = await review();
    expect(result?.rows.find((row) => row.allocationId === "alloc-rent")?.actualCentavos).toBe(0);
    expect(result?.rows.find((row) => row.allocationId === "alloc-food")?.actualCentavos).toBe(1000);
    expect(result?.unplannedActualCentavos).toBe(700);
  });

  it("excludes out-of-period, pending, deleted and non-expense transactions and includes the period boundaries", async () => {
    insertTx({ id: "start", amount: 100, sub: "sub-groceries", date: "2026-09-01" });
    insertTx({ id: "end", amount: 200, sub: "sub-groceries", date: "2026-09-30" });
    insertTx({ id: "before", amount: 1000, sub: "sub-groceries", date: "2026-08-31" });
    insertTx({ id: "after", amount: 1000, sub: "sub-groceries", date: "2026-10-01" });
    insertTx({ id: "pending", amount: 1000, sub: "sub-groceries", status: "pending" });
    insertTx({ id: "deleted", amount: 1000, sub: "sub-groceries", deleted: 1 });
    insertTx({ id: "income", amount: 1000, sub: "sub-groceries", type: "income" });

    const result = await review();

    expect(result?.actualTotalCentavos).toBe(300);
    expect(result?.rows[0]?.actualCentavos).toBe(300);
  });

  it("flags exceeded allocations and an exceeded plan total driven by unplanned spending", async () => {
    insertTx({ id: "t1", amount: 12000, sub: "sub-dining" });
    insertTx({ id: "t2", amount: 49000, sub: "sub-fun" });

    const result = await review();

    expect(result?.rows[0]).toMatchObject({ actualCentavos: 12000, varianceCentavos: -2000, exceeded: true });
    expect(result?.rows[1]).toMatchObject({ actualCentavos: 0, varianceCentavos: 50000, exceeded: false });
    expect(result).toMatchObject({ plannedTotalCentavos: 60000, actualTotalCentavos: 61000, unplannedActualCentavos: 49000, exceeded: true });
  });

  it("ignores another user's transactions, payments and plans", async () => {
    insertTx({ id: "mine", amount: 1000, sub: "sub-groceries" });
    insertTx({ id: "theirs", amount: 99000, sub: "sub-groceries", user: "user-2" });
    insertTx({ id: "mine-linked-by-other", amount: 500, sub: "sub-groceries" });
    sqlite.exec("INSERT INTO debt_payments VALUES ('dp-x', 'user-2', 'mine-linked-by-other', 0)");

    expect((await review())?.actualTotalCentavos).toBe(1500);
    expect(await review("user-2", "plan-1")).toBeNull();
  });

  it("returns null for a missing, deleted or non-accepted plan", async () => {
    sqlite.exec(`
      INSERT INTO financial_plans VALUES ('plan-deleted', 'user-1', '2026-08-01', '2026-08-31', 'accepted', 1);
      INSERT INTO financial_plans VALUES ('plan-draft', 'user-1', '2026-07-01', '2026-07-31', 'draft', 0);
    `);

    await expect(review("user-1", "missing")).resolves.toBeNull();
    await expect(review("user-1", "plan-deleted")).resolves.toBeNull();
    await expect(review("user-1", "plan-draft")).resolves.toBeNull();
  });
});
