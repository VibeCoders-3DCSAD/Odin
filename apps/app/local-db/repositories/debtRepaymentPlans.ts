import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import { randomUUID } from "../uuid";

export type DebtStrategy = "snowball" | "avalanche";
export type DebtPriority = { debtAccountId: string; priorityRank: number };

async function getDb() { return initDatabase(); }
function now() { return new Date().toISOString(); }

export async function getDebtStrategy(userId: string): Promise<DebtStrategy> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ strategy: DebtStrategy }>("SELECT strategy FROM debt_strategy_preferences WHERE user_id = ? AND deleted = 0", userId);
  return row?.strategy === "snowball" ? "snowball" : "avalanche";
}

export async function saveDebtStrategy(userId: string, deviceId: string, strategy: DebtStrategy): Promise<void> {
  if (strategy !== "snowball" && strategy !== "avalanche") throw new LocalDbError("VALIDATION_ERROR", "Select Snowball or Avalanche.");
  const db = await getDb(); const timestamp = now();
  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<{ version: number }>("SELECT version FROM debt_strategy_preferences WHERE user_id = ?", userId);
    if (current) await db.runAsync("UPDATE debt_strategy_preferences SET strategy = ?, deleted = 0, version = version + 1, updated_at = ? WHERE user_id = ?", strategy, timestamp, userId);
    else await db.runAsync("INSERT INTO debt_strategy_preferences (user_id, strategy, version, deleted, created_at, updated_at) VALUES (?, ?, 1, 0, ?, ?)", userId, strategy, timestamp, timestamp);
    await enqueueOperation(db, { userId, deviceId, entity: "debt_strategy_preferences", recordId: userId, operationType: current ? "update" : "create", baseVersion: current?.version ?? null, changedFields: ["strategy"], payload: { strategy }, failureMessage: "Your debt repayment strategy could not be saved." });
  });
}

export async function listDebtPriorities(userId: string): Promise<DebtPriority[]> {
  const db = await getDb();
  return db.getAllAsync<{ debt_account_id: string; priority_rank: number }>("SELECT debt_account_id, priority_rank FROM user_debt_priorities WHERE user_id = ? AND deleted = 0 ORDER BY priority_rank", userId).then((rows) => rows.map((row) => ({ debtAccountId: row.debt_account_id, priorityRank: row.priority_rank })));
}

export async function saveDebtPriorities(userId: string, deviceId: string, debtAccountIds: string[]): Promise<void> {
  if (new Set(debtAccountIds).size !== debtAccountIds.length) throw new LocalDbError("VALIDATION_ERROR", "A debt can only have one priority.");
  const db = await getDb(); const timestamp = now();
  await db.withTransactionAsync(async () => {
    const active = await db.getAllAsync<{ id: string }>(`SELECT id FROM debt_accounts WHERE user_id = ? AND id IN (${debtAccountIds.map(() => "?").join(",") || "NULL"}) AND status = 'active' AND deleted = 0`, userId, ...debtAccountIds);
    if (active.length !== debtAccountIds.length) throw new LocalDbError("VALIDATION_ERROR", "Priorities must reference active debts.");
    await db.runAsync("UPDATE user_debt_priorities SET deleted = 1, updated_at = ?, version = version + 1 WHERE user_id = ? AND deleted = 0", timestamp, userId);
    for (const [index, debtAccountId] of debtAccountIds.entries()) await db.runAsync("INSERT INTO user_debt_priorities (id, user_id, debt_account_id, priority_rank, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)", randomUUID(), userId, debtAccountId, index + 1, timestamp, timestamp);
    await enqueueOperation(db, { userId, deviceId, entity: "user_debt_priorities", recordId: userId, operationType: "update", baseVersion: null, changedFields: ["priorities"], payload: { priorities: debtAccountIds }, failureMessage: "Your debt priorities could not be saved." });
  });
}
