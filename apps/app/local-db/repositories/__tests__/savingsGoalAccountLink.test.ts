import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import m051 from "../../migrations/051_savings_goals";
import m053 from "../../migrations/053_savings_goal_model";
import m056 from "../../migrations/056_savings_goal_contribution_schedule";
import m074 from "../../migrations/074_remove_savings_goal_category";
import m084 from "../../migrations/084_savings_goal_account_link";
import { createSavingsGoal, getSavingsGoal, updateSavingsGoal } from "../savingsGoals";
import { listActiveSavingsGoalAccounts } from "../savingsGoalAccounts";

let mockSqlite: DatabaseSync;
const mockDb = {
  execAsync: async (sql: string) => { mockSqlite.exec(sql); },
  runAsync: async (sql: string, ...args: SQLInputValue[]) => mockSqlite.prepare(sql).run(...args),
  getFirstAsync: async (sql: string, ...args: SQLInputValue[]) => mockSqlite.prepare(sql).get(...args) ?? null,
  getAllAsync: async (sql: string, ...args: SQLInputValue[]) => mockSqlite.prepare(sql).all(...args),
  withTransactionAsync: async (callback: () => Promise<void>) => {
    mockSqlite.exec("BEGIN");
    try { await callback(); mockSqlite.exec("COMMIT"); } catch (error) { mockSqlite.exec("ROLLBACK"); throw error; }
  },
};
jest.mock("../../client", () => ({ initDatabase: async () => mockDb }));

const input = { name: "Travel", linkedAccountId: "active-account", goalType: "custom" as const, targetAmountCentavos: 100_000, startingAmountCentavos: 0, targetDate: "2026-12-31", priority: "high" as const };

describe("savings goal account persistence in SQLite", () => {
  beforeEach(async () => {
    mockSqlite = new DatabaseSync(":memory:");
    mockSqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE financial_accounts (id text PRIMARY KEY, user_id text, name text, kind text DEFAULT 'bank', status text, deleted integer DEFAULT 0);
      INSERT INTO financial_accounts (id, user_id, name, status, deleted) VALUES
        ('active-account', 'user-1', 'Main account', 'active', 0),
        ('other-account', 'user-2', 'Other user', 'active', 0),
        ('archived-account', 'user-1', 'Archived', 'archived', 0),
        ('deleted-account', 'user-1', 'Deleted', 'active', 1);
      INSERT INTO financial_accounts (id, user_id, name, kind, status) VALUES
        ('credit-card', 'user-1', 'Rewards Visa', 'credit_card', 'active');
      CREATE TABLE transactions (id text);
      CREATE TABLE sync_queue (operation_id text, user_id text, device_id text, entity text, record_id text, operation_type text, base_version integer, changed_fields text, payload text, failure_message text, status text, attempts integer, last_error text, created_at text);
    `);
    for (const migration of [m051, m053, m056, m074, m084]) await migration.up(mockDb as never);
  });
  afterEach(() => mockSqlite.close());

  it("persists the link in the goal, its read model, and its sync payload", async () => {
    const result = await createSavingsGoal("user-1", "device-1", input);
    expect(result.goal.linkedAccountId).toBe("active-account");
    expect(result.goal.linkedAccountName).toBe("Main account");
    expect(result.operation.payload.linked_account_id).toBe("active-account");
    expect((await getSavingsGoal("user-1", result.goal.id))?.linkedAccountId).toBe("active-account");
    expect(await getSavingsGoal("user-2", result.goal.id)).toBeNull();
  });

  it.each(["other-account", "archived-account", "deleted-account", "missing-account", "credit-card"])("rejects %s without inserting a goal or sync operation", async (linkedAccountId) => {
    await expect(createSavingsGoal("user-1", "device-1", { ...input, linkedAccountId })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mockSqlite.prepare("SELECT count(*) AS count FROM savings_goals").get()?.count).toBe(0);
    expect(mockSqlite.prepare("SELECT count(*) AS count FROM sync_queue").get()?.count).toBe(0);
  });

  it("allows unrelated edits after the linked account is archived", async () => {
    const { goal } = await createSavingsGoal("user-1", "device-1", input);
    mockSqlite.exec("UPDATE financial_accounts SET status = 'archived' WHERE id = 'active-account'");
    const result = await updateSavingsGoal("user-1", "device-1", goal.id, { name: "Japan trip" });
    expect(result.goal.linkedAccountId).toBe("active-account");
    expect(result.operation?.changed_fields).toEqual(["name"]);
  });

  it("excludes credit cards and unavailable accounts from selector results and escapes wildcard searches", async () => {
    expect(await listActiveSavingsGoalAccounts("user-1")).toEqual([{ id: "active-account", name: "Main account", kind: "bank", status: "active" }]);
    expect(await listActiveSavingsGoalAccounts("user-1", "Main")).toHaveLength(1);
    expect(await listActiveSavingsGoalAccounts("user-1", "Visa")).toEqual([]);
    expect(await listActiveSavingsGoalAccounts("user-1", "%")).toEqual([]);
  });

  it("repairs an older offline create when the user links its goal", async () => {
    const { goal } = await createSavingsGoal("user-1", "device-1", input);
    mockSqlite.prepare("UPDATE savings_goals SET linked_account_id = NULL WHERE id = ?").run(goal.id);
    mockSqlite.exec("UPDATE sync_queue SET payload = json_remove(payload, '$.linked_account_id'), status = 'failed', attempts = 3, last_error = 'missing link'");
    await updateSavingsGoal("user-1", "device-1", goal.id, { linkedAccountId: "active-account" });
    const queued = mockSqlite.prepare("SELECT payload, status, attempts, last_error FROM sync_queue WHERE operation_type = 'create'").get();
    expect(JSON.parse(String(queued?.payload)).linked_account_id).toBe("active-account");
    expect(queued).toMatchObject({ status: "pending", attempts: 0, last_error: null });
  });

});
