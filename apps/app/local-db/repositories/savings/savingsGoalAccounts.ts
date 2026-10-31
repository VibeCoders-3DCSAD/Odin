import type { SQLiteDatabase } from "expo-sqlite";
import type { FinancialAccountKind } from "../foundations/financialFoundations";
import { initDatabase } from "../../client";
import { LocalDbError } from "../../helpers";

export type SavingsGoalAccount = { id: string; name: string; kind?: FinancialAccountKind; status: "active" | "archived" };

export async function listActiveSavingsGoalAccounts(userId: string, search = ""): Promise<SavingsGoalAccount[]> {
  const db = await initDatabase();
  const pattern = `%${search.trim().slice(0, 100).replace(/[\\%_]/g, "\\$&")}%`;
  return db.getAllAsync<SavingsGoalAccount>(
    "SELECT id, name, kind, status FROM financial_accounts WHERE user_id = ? AND deleted = 0 AND status = 'active' AND kind <> 'credit_card' AND name LIKE ? ESCAPE '\\' ORDER BY name COLLATE NOCASE, id LIMIT 100",
    userId, pattern,
  );
}

export async function getSavingsGoalAccount(userId: string, accountId: string): Promise<SavingsGoalAccount | null> {
  const db = await initDatabase();
  return db.getFirstAsync<SavingsGoalAccount>(
    "SELECT id, name, kind, status FROM financial_accounts WHERE user_id = ? AND id = ? AND deleted = 0 LIMIT 1", userId, accountId,
  );
}

export async function assertActiveSavingsGoalAccount(db: SQLiteDatabase, userId: string, accountId: unknown): Promise<void> {
  if (typeof accountId !== "string" || !accountId.trim()) throw new LocalDbError("VALIDATION_ERROR", "Select an active financial account for this savings goal.");
  const account = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM financial_accounts WHERE user_id = ? AND id = ? AND deleted = 0 AND status = 'active' AND kind <> 'credit_card' LIMIT 1", userId, accountId,
  );
  if (!account) throw new LocalDbError("VALIDATION_ERROR", "Select an active financial account for this savings goal.");
}
