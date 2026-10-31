import { jest } from "@jest/globals";
import { DatabaseSync } from "node:sqlite";

// Real in-memory SQLite (node:sqlite) behind the expo-sqlite async methods the repositories use.
const mockInitDatabase = jest.fn<() => Promise<unknown>>();
jest.mock("../../../client", () => ({ initDatabase: () => mockInitDatabase() }));

const SCHEMA = `
  CREATE TABLE financial_plans (id text primary key, user_id text not null, period_start text not null, period_end text not null, status text not null, deleted integer not null default 0, updated_at text not null default '');
  CREATE TABLE financial_plan_allocations (id text primary key, plan_id text not null, category_id text, subcategory_id text, allocation_rule text not null, allocated_amount_centavos integer not null);
  CREATE TABLE categories (id text primary key, user_id text not null, label text not null, is_system integer not null default 1);
  CREATE TABLE subcategories (id text primary key, user_id text not null, category_id text, label text not null default '', is_system integer not null default 1, deleted integer not null default 0);
  CREATE TABLE transactions (id text primary key, user_id text not null, transaction_type text not null, status text not null, transaction_date text not null, amount_centavos integer not null, subcategory_id text, category_id text, source_savings_goal_id text, destination_savings_goal_id text, deleted integer not null default 0);
  CREATE TABLE debt_payments (id text primary key, user_id text not null, transaction_id text, deleted integer not null default 0);
  CREATE TABLE credit_card_payments (id text primary key, user_id text not null, transaction_id text, deleted integer not null default 0);
  CREATE TABLE scheduled_payment_records (id text primary key, user_id text not null, transaction_id text, deleted integer not null default 0);
`;

let sqlite: DatabaseSync;

function spend(id: string, amount: number, subcategory: string, date = "2026-10-10") {
  sqlite.prepare("INSERT INTO transactions (id, user_id, transaction_type, status, transaction_date, amount_centavos, subcategory_id) VALUES (?, 'user-1', 'expense', 'posted', ?, ?, ?)").run(id, date, amount, subcategory);
}

async function safeToSpend(today = "2026-10-19") {
  const { getSafeToSpend } = await import("../safeToSpend");
  return getSafeToSpend("user-1", today);
}

describe("getSafeToSpend", () => {
  beforeEach(() => {
    jest.resetModules();
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(SCHEMA);
    sqlite.exec(`
      INSERT INTO financial_plans (id, user_id, period_start, period_end, status) VALUES ('plan-oct', 'user-1', '2026-10-01', '2026-10-31', 'accepted');
      INSERT INTO financial_plans (id, user_id, period_start, period_end, status) VALUES ('plan-sep', 'user-1', '2026-09-01', '2026-09-30', 'accepted');
      INSERT INTO financial_plan_allocations VALUES ('alloc-food', 'plan-oct', 'cat-food', NULL, 'FLEXIBLE', 400000);
      INSERT INTO financial_plan_allocations VALUES ('alloc-fare', 'plan-oct', 'cat-transport', NULL, 'FLEXIBLE', 150000);
      INSERT INTO financial_plan_allocations VALUES ('alloc-dining', 'plan-oct', 'cat-dining', NULL, 'FLEXIBLE', 100000);
      INSERT INTO financial_plan_allocations VALUES ('alloc-fun', 'plan-oct', 'cat-fun', NULL, 'FLEXIBLE', 200000);
      INSERT INTO categories VALUES ('cat-food', 'system', 'Food and groceries', 1);
      INSERT INTO categories VALUES ('cat-transport', 'system', 'Transportation', 1);
      INSERT INTO categories VALUES ('cat-dining', 'system', 'Eating out', 1);
      INSERT INTO categories VALUES ('cat-fun', 'system', 'Leisure', 1);
      INSERT INTO subcategories (id, user_id, category_id) VALUES ('sub-groceries', 'system', 'cat-food');
      INSERT INTO subcategories (id, user_id, category_id) VALUES ('sub-jeep', 'system', 'cat-transport');
      INSERT INTO subcategories (id, user_id, category_id) VALUES ('sub-resto', 'system', 'cat-dining');
      INSERT INTO subcategories (id, user_id, category_id) VALUES ('sub-fun', 'system', 'cat-fun');
      INSERT INTO subcategories (id, user_id, category_id) VALUES ('sub-gifts', 'system', 'cat-gifts');
    `);
    mockInitDatabase.mockResolvedValue({
      getFirstAsync: async (sql: string, ...params: any[]) => sqlite.prepare(sql).get(...params) ?? null,
      getAllAsync: async (sql: string, ...params: any[]) => sqlite.prepare(sql).all(...params),
    });
  });

  afterEach(() => sqlite.close());

  it("splits what is left in today's plan across the remaining days and lists the budgets closest to their limit", async () => {
    spend("t1", 380000, "sub-groceries");
    spend("t2", 110000, "sub-jeep");
    spend("t3", 60000, "sub-resto");
    spend("t4", 20000, "sub-fun");
    spend("t5", 10000, "sub-gifts");

    await expect(safeToSpend()).resolves.toEqual({
      periodEnd: "2026-10-31",
      daysLeft: 13,
      plannedCentavos: 850000,
      spentCentavos: 580000,
      leftCentavos: 270000,
      dailyCentavos: 20769,
      categories: [
        { allocationId: "alloc-food", label: "Food and groceries", plannedCentavos: 400000, spentCentavos: 380000 },
        { allocationId: "alloc-fare", label: "Transportation", plannedCentavos: 150000, spentCentavos: 110000 },
        { allocationId: "alloc-dining", label: "Eating out", plannedCentavos: 100000, spentCentavos: 60000 },
      ],
    });
  });

  it("reports an overspent cycle with nothing to spend per day", async () => {
    spend("t1", 900000, "sub-groceries");

    await expect(safeToSpend("2026-10-31")).resolves.toMatchObject({ daysLeft: 1, leftCentavos: -50000, dailyCentavos: 0 });
  });

  it("returns null when no accepted plan covers today", async () => {
    await expect(safeToSpend("2026-11-02")).resolves.toBeNull();
  });
});
