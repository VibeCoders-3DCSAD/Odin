import { jest } from "@jest/globals";
import { createSqliteHarness } from "./sqliteHarness";

const mockInitDatabase = jest.fn<() => Promise<unknown>>();
jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));

import { _resetDbCacheForTesting, getCashFlowSummary, getCashOutflowDistribution, listCategoryBreakdown } from "../financialReports";

let harness: ReturnType<typeof createSqliteHarness>;
const range = { startDate: "2026-10-01", endDate: "2026-10-17" };

beforeEach(() => {
  _resetDbCacheForTesting();
  harness = createSqliteHarness();
  harness.sqlite.exec(`
    CREATE TABLE transactions (id text primary key, user_id text, transaction_type text, status text default 'posted', transaction_date text default '2026-10-10', amount_centavos integer, subcategory_id text, destination_savings_goal_id text, deleted integer default 0);
    CREATE TABLE subcategories (id text primary key, user_id text, label text, deleted integer default 0);
    CREATE TABLE debt_payments (id text primary key, user_id text, transaction_id text, deleted integer default 0);
    CREATE TABLE credit_card_payments (id text primary key, user_id text, transaction_id text, deleted integer default 0);
    CREATE TABLE scheduled_payment_records (id text primary key, user_id text, transaction_id text, deleted integer default 0);
  `);
  mockInitDatabase.mockResolvedValue(harness.db);
});

afterEach(() => harness.sqlite.close());

function transaction(id: string, amount: number, type = "expense", goal: string | null = null) {
  harness.sqlite.prepare("INSERT INTO transactions (id, user_id, transaction_type, amount_centavos, destination_savings_goal_id) VALUES (?, 'user-1', ?, ?, ?)").run(id, type, amount, goal);
}

it("breaks linked biller and card payments out of uncategorised in both reports", async () => {
  transaction("bill", 20_000);
  transaction("card", 30_000);
  transaction("debt", 10_000);
  transaction("saving", 5_000, "transfer", "goal-1");
  transaction("transfer", 90_000, "transfer");
  transaction("unknown", 100);
  harness.sqlite.exec(`
    INSERT INTO scheduled_payment_records VALUES ('bill-link', 'user-1', 'bill', 0);
    INSERT INTO credit_card_payments VALUES ('card-link', 'user-1', 'card', 0);
    INSERT INTO debt_payments VALUES ('debt-link', 'user-1', 'debt', 0);
  `);

  const result = await getCashOutflowDistribution("user-1", range);
  expect(result).toEqual([
    { label: "Debt repayments", amountCentavos: 40_000 },
    { label: "Billers & remittances", amountCentavos: 20_000 },
    { label: "Savings contributions", amountCentavos: 5_000 },
    { label: "Uncategorised", amountCentavos: 100 },
  ]);
  expect(await listCategoryBreakdown("user-1", range)).toEqual(result.filter((item) => item.label !== "Savings contributions"));
  expect(result.reduce((sum, item) => sum + item.amountCentavos, 0)).toBe((await getCashFlowSummary("user-1", range)).outflowCentavos);
});

it("ignores deleted and foreign ownership links and counts each transaction once", async () => {
  transaction("unknown", 100);
  transaction("bill", 200);
  harness.sqlite.exec(`
    INSERT INTO debt_payments VALUES ('deleted', 'user-1', 'unknown', 1);
    INSERT INTO credit_card_payments VALUES ('foreign', 'user-2', 'unknown', 0);
    INSERT INTO scheduled_payment_records VALUES ('foreign', 'user-2', 'unknown', 0);
    INSERT INTO scheduled_payment_records VALUES ('one', 'user-1', 'bill', 0), ('two', 'user-1', 'bill', 0);
  `);
  expect(await getCashOutflowDistribution("user-1", range)).toEqual([
    { label: "Billers & remittances", amountCentavos: 200 },
    { label: "Uncategorised", amountCentavos: 100 },
  ]);
});

it("classifies linked payments before their expense subcategory and respects the report boundary", async () => {
  for (const id of ["bill", "card", "food", "pending", "deleted", "foreign", "before", "after"]) transaction(id, 100);
  harness.sqlite.exec(`
    INSERT INTO subcategories VALUES ('food', 'user-1', 'Groceries', 0);
    UPDATE transactions SET subcategory_id = 'food';
    UPDATE transactions SET status = 'pending' WHERE id = 'pending';
    UPDATE transactions SET deleted = 1 WHERE id = 'deleted';
    UPDATE transactions SET user_id = 'user-2' WHERE id = 'foreign';
    UPDATE transactions SET transaction_date = '2026-09-30' WHERE id = 'before';
    UPDATE transactions SET transaction_date = '2026-10-18' WHERE id = 'after';
    UPDATE transactions SET transaction_date = '2026-10-01' WHERE id = 'bill';
    UPDATE transactions SET transaction_date = '2026-10-17' WHERE id = 'card';
    INSERT INTO scheduled_payment_records VALUES ('bill-link', 'user-1', 'bill', 0);
    INSERT INTO credit_card_payments VALUES ('card-link', 'user-1', 'card', 0);
  `);
  const result = await getCashOutflowDistribution("user-1", range);
  expect(result).toHaveLength(3);
  expect(result).toEqual(expect.arrayContaining([
    { label: "Billers & remittances", amountCentavos: 100 },
    { label: "Debt repayments", amountCentavos: 100 },
    { label: "Groceries", amountCentavos: 100 },
  ]));
});

it("preserves the full cash outflow total when small categories roll into Other", async () => {
  for (let index = 1; index <= 7; index++) {
    transaction(`expense-${index}`, index * 100);
    harness.sqlite.prepare("INSERT INTO subcategories (id, user_id, label) VALUES (?, 'user-1', ?)").run(`sub-${index}`, `Category ${index}`);
    harness.sqlite.prepare("UPDATE transactions SET subcategory_id = ? WHERE id = ?").run(`sub-${index}`, `expense-${index}`);
  }
  const result = await getCashOutflowDistribution("user-1", range);
  expect(result).toHaveLength(6);
  expect(result[5]).toEqual({ label: "Other", amountCentavos: 300 });
  expect(result.reduce((sum, item) => sum + item.amountCentavos, 0)).toBe((await getCashFlowSummary("user-1", range)).outflowCentavos);
});
