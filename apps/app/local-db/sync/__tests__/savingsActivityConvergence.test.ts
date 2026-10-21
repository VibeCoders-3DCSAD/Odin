import { DatabaseSync } from "node:sqlite";
import type { SQLiteBindValue } from "expo-sqlite";
import { applyPullRow } from "../pullConvergence";

it("pulls savings activity tombstones and resurrects the same activity identity", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE savings_goal_activities(id text PRIMARY KEY, user_id text, transaction_id text, savings_goal_id text, amount_centavos integer, version integer, deleted integer, updated_at text, last_synced_at text);
    CREATE UNIQUE INDEX live_goal ON savings_goal_activities(user_id, transaction_id, savings_goal_id) WHERE deleted = 0;
    INSERT INTO savings_goal_activities VALUES ('activity', 'user', 'expense', 'goal', 10000, 1, 0, 'old', NULL);`);
  const db = {
    getFirstAsync: async <T,>(sql: string, ...args: SQLiteBindValue[]) => (sqlite.prepare(sql).get(...args.map((value) => typeof value === "boolean" ? Number(value) : value)) ?? null) as T | null,
    runAsync: async (sql: string, ...args: SQLiteBindValue[]) => { const result = sqlite.prepare(sql).run(...args.map((value) => typeof value === "boolean" ? Number(value) : value)); return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }; },
  };
  try {
    await applyPullRow(db, "savings_goal_activities", { id: "activity", user_id: "user", version: 2, deleted: true });
    expect(sqlite.prepare("SELECT deleted FROM savings_goal_activities").get()?.deleted).toBe(1);
    await applyPullRow(db, "savings_goal_activities", { id: "activity", user_id: "user", transaction_id: "expense", savings_goal_id: "goal", amount_centavos: 5000, version: 3, deleted: 0 });
    expect(sqlite.prepare("SELECT amount_centavos, deleted FROM savings_goal_activities").get()).toEqual({ amount_centavos: 5000, deleted: 0 });
  } finally { sqlite.close(); }
});
