import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { getEmergencyFundBaseline } from "../savingsGoals";

let mockSqlite: DatabaseSync;
jest.mock("../../../client", () => ({ initDatabase: async () => ({
  getFirstAsync: async (sql: string, ...args: SQLInputValue[]) => mockSqlite.prepare(sql).get(...args),
}) }));

beforeEach(() => {
  mockSqlite = new DatabaseSync(":memory:");
  mockSqlite.exec(`
    CREATE TABLE transactions (user_id TEXT, category_id TEXT, subcategory_id TEXT, amount_centavos INTEGER, transaction_type TEXT DEFAULT 'expense', status TEXT DEFAULT 'posted', deleted INTEGER DEFAULT 0, transaction_date TEXT DEFAULT '2026-09-01');
    CREATE TABLE categories (id TEXT, user_id TEXT, is_system INTEGER DEFAULT 0, deleted INTEGER DEFAULT 0, classification TEXT);
    CREATE TABLE subcategories (id TEXT, user_id TEXT, is_system INTEGER DEFAULT 0, deleted INTEGER DEFAULT 0, category_id TEXT);
    INSERT INTO categories (id, user_id, classification) VALUES ('food', 'user', 'essential'), ('fun', 'user', 'non_essential'), ('foreign', 'other', 'essential');
    INSERT INTO subcategories (id, user_id, category_id) VALUES ('groceries', 'user', 'food');
  `);
});
afterEach(() => mockSqlite.close());

it("averages only the user's posted essentials over six completed months with category and legacy subcategory support", async () => {
  mockSqlite.exec(`
    INSERT INTO transactions (user_id, category_id, subcategory_id, amount_centavos) VALUES
      ('user', 'food', NULL, 600000), ('user', NULL, 'groceries', 300000),
      ('user', 'fun', 'groceries', 900000), ('other', 'food', NULL, 900000),
      ('user', 'foreign', NULL, 900000);
    INSERT INTO transactions (user_id, category_id, amount_centavos, status) VALUES ('user', 'food', 900000, 'draft');
    INSERT INTO transactions (user_id, category_id, amount_centavos, deleted) VALUES ('user', 'food', 900000, 1);
    INSERT INTO transactions (user_id, category_id, amount_centavos, transaction_type) VALUES ('user', 'food', 900000, 'income');
    INSERT INTO transactions (user_id, category_id, amount_centavos, transaction_date) VALUES
      ('user', 'food', 900000, '2026-10-01'), ('user', 'food', 900000, '2026-03-31');
  `);
  expect(await getEmergencyFundBaseline("user", new Date("2026-10-22T00:00:00Z"))).toBe(150000);
  expect(await getEmergencyFundBaseline("empty", new Date("2026-10-22T00:00:00Z"))).toBe(0);
});
