import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";

export const SAVINGS_ALLOCATION_STRATEGIES = ["avalanche", "snowball"] as const;
export type SavingsAllocationStrategy = typeof SAVINGS_ALLOCATION_STRATEGIES[number];

function now() { return new Date().toISOString(); }

export async function getSavingsAllocationStrategy(userId: string): Promise<SavingsAllocationStrategy> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<{ strategy: SavingsAllocationStrategy }>(
    "SELECT strategy FROM savings_allocation_preferences WHERE user_id = ? AND deleted = 0",
    userId,
  );
  return row?.strategy === "snowball" ? "snowball" : "avalanche";
}

export async function saveSavingsAllocationStrategy(userId: string, deviceId: string, strategy: SavingsAllocationStrategy): Promise<void> {
  if (!SAVINGS_ALLOCATION_STRATEGIES.includes(strategy)) throw new LocalDbError("VALIDATION_ERROR", "Select Avalanche or Snowball.");
  const db = await initDatabase();
  const timestamp = now();
  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<{ version: number }>("SELECT version FROM savings_allocation_preferences WHERE user_id = ?", userId);
    if (current) await db.runAsync("UPDATE savings_allocation_preferences SET strategy = ?, deleted = 0, version = version + 1, updated_at = ? WHERE user_id = ?", strategy, timestamp, userId);
    else await db.runAsync("INSERT INTO savings_allocation_preferences (user_id, strategy, version, deleted, created_at, updated_at) VALUES (?, ?, 1, 0, ?, ?)", userId, strategy, timestamp, timestamp);
    await enqueueOperation(db, { userId, deviceId, entity: "savings_allocation_preferences", recordId: userId, operationType: current ? "update" : "create", baseVersion: current?.version ?? null, changedFields: ["strategy"], payload: { strategy }, failureMessage: "Your savings allocation strategy could not be saved." });
  });
}
