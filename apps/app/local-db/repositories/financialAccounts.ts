import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";

const VALID_KINDS = ["cash", "bank", "e_wallet", "savings", "credit_card", "loan", "other"] as const;
const VALID_STATUSES = ["active", "archived", "deleted"] as const;
const UPDATE_FIELDS = ["name", "opening_balance_centavos", "credit_limit_centavos", "include_in_dashboard_balance", "institution_name", "opened_on", "sort_order"] as const;

type FinancialAccountRow = {
  id: string;
  user_id: string;
  name: string;
  kind: string;
  status: string;
  opening_balance_centavos: number;
  current_balance_centavos: number;
  credit_limit_centavos: number | null;
  include_in_dashboard_balance: number;
  institution_name: string | null;
  opened_on: string | null;
  archived_at: string | null;
  sort_order: number;
  metadata: string;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

export type FinancialAccount = {
  id: string;
  name: string;
  kind: string;
  status: string;
  opening_balance_centavos: number;
  current_balance_centavos: number;
  credit_limit_centavos: number | null;
  include_in_dashboard_balance: boolean;
  institution_name: string | null;
  opened_on: string | null;
  sort_order: number;
};

export type CreateFinancialAccountInput = {
  name: string;
  kind: string;
  opening_balance_centavos?: number;
  credit_limit_centavos?: number | null;
  include_in_dashboard_balance?: boolean;
  institution_name?: string | null;
  opened_on?: string | null;
  sort_order?: number;
};

export type UpdateFinancialAccountInput = {
  name?: string;
  opening_balance_centavos?: number;
  credit_limit_centavos?: number | null;
  include_in_dashboard_balance?: boolean;
  institution_name?: string | null;
  opened_on?: string | null;
  sort_order?: number;
};

function mapAccount(row: FinancialAccountRow): FinancialAccount {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    status: row.status,
    opening_balance_centavos: row.opening_balance_centavos,
    current_balance_centavos: row.current_balance_centavos,
    credit_limit_centavos: row.credit_limit_centavos,
    include_in_dashboard_balance: row.include_in_dashboard_balance === 1,
    institution_name: row.institution_name,
    opened_on: row.opened_on,
    sort_order: row.sort_order,
  };
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function boolToInt(v: boolean | undefined | null): number {
  return v ? 1 : 0;
}

function now(): string {
  return new Date().toISOString();
}

export async function listFinancialAccounts(
  userId: string,
  status?: string,
): Promise<FinancialAccount[]> {
  const db = await getDb();
  let sql = "SELECT * FROM financial_accounts WHERE user_id = ? AND deleted = 0";
  const params: SQLite.SQLiteBindValue[] = [userId];

  if (status) {
    if (!(VALID_STATUSES as readonly string[]).includes(status)) {
      throw new LocalDbError("VALIDATION_ERROR", `status must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    sql += " AND status = ?";
    params.push(status);
  }
  sql += " ORDER BY sort_order";

  const rows = await db.getAllAsync<FinancialAccountRow>(sql, ...params);
  return rows.map(mapAccount);
}

export async function getFinancialAccount(
  userId: string,
  id: string,
): Promise<FinancialAccount | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<FinancialAccountRow>(
    "SELECT * FROM financial_accounts WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    id,
  );
  return row ? mapAccount(row) : null;
}

export async function createFinancialAccount(
  userId: string,
  deviceId: string,
  input: CreateFinancialAccountInput,
): Promise<{ account: FinancialAccount; operation: SyncOperation }> {
  if (!input.name?.trim()) {
    throw new LocalDbError("VALIDATION_ERROR", "name is required");
  }
  if (!VALID_KINDS.includes(input.kind as typeof VALID_KINDS[number])) {
    throw new LocalDbError("VALIDATION_ERROR", `kind must be one of: ${VALID_KINDS.join(", ")}`);
  }
  if (input.opening_balance_centavos != null) {
    if (typeof input.opening_balance_centavos !== "number" || !Number.isFinite(input.opening_balance_centavos) || !Number.isInteger(input.opening_balance_centavos)) {
      throw new LocalDbError("VALIDATION_ERROR", "opening_balance_centavos must be a finite integer");
    }
  }
  if (input.credit_limit_centavos != null && (typeof input.credit_limit_centavos !== "number" || !Number.isFinite(input.credit_limit_centavos) || !Number.isInteger(input.credit_limit_centavos) || input.credit_limit_centavos < 0)) {
    throw new LocalDbError("VALIDATION_ERROR", "credit_limit_centavos must be a finite integer >= 0");
  }

  const db = await getDb();
  const id = randomUUID();
  const ts = now();
  const openingBalance = input.opening_balance_centavos ?? 0;
  const metadata = "{}";

  let result: { account: FinancialAccount; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO financial_accounts
        (id, user_id, name, kind, status, opening_balance_centavos, current_balance_centavos,
         credit_limit_centavos, include_in_dashboard_balance, institution_name,
         opened_on, sort_order, metadata, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      id,
      userId,
      input.name.trim(),
      input.kind,
      openingBalance,
      openingBalance,
      input.credit_limit_centavos ?? null,
      boolToInt(input.include_in_dashboard_balance ?? true),
      input.institution_name ?? null,
      input.opened_on ?? null,
      input.sort_order ?? 0,
      metadata,
      ts,
      ts,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "financial_accounts",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: [],
      payload: { ...input, name: input.name.trim() },
      failureMessage: `This financial account "${input.name.trim()}" could not be created.`,
    });

    const row = await db.getFirstAsync<FinancialAccountRow>(
      "SELECT * FROM financial_accounts WHERE user_id = ? AND id = ?",
      userId,
      id,
    );

    result = { account: mapAccount(row!), operation };
  });

  return result!;
}

export async function updateFinancialAccount(
  userId: string,
  deviceId: string,
  id: string,
  input: UpdateFinancialAccountInput,
): Promise<{ account: FinancialAccount; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { account: FinancialAccount; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<FinancialAccountRow>(
      "SELECT * FROM financial_accounts WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Financial account not found");

    const updates: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];
    const changedFields: string[] = [];

    for (const key of UPDATE_FIELDS) {
      const value = (input as Record<string, unknown>)[key];
      if (value === undefined) continue;

      if (key === "credit_limit_centavos") {
        if (value != null && (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0)) {
          throw new LocalDbError("VALIDATION_ERROR", "credit_limit_centavos must be a finite integer >= 0");
        }
      }
      if (key === "opening_balance_centavos") {
        if (value != null && (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value))) {
          throw new LocalDbError("VALIDATION_ERROR", "opening_balance_centavos must be a finite integer");
        }
      }

      changedFields.push(key);

      if (key === "include_in_dashboard_balance") {
        updates.push(`${key} = ?`);
        params.push(boolToInt(value as boolean));
      } else {
        updates.push(`${key} = ?`);
        params.push(value as SQLite.SQLiteBindValue);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = ?");
      params.push(ts);
      updates.push("version = version + 1");

      const sql = `UPDATE financial_accounts SET ${updates.join(", ")} WHERE user_id = ? AND id = ?`;
      params.push(userId);
      params.push(id);
      await db.runAsync(sql, ...params);
    }

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "financial_accounts",
      recordId: id,
      operationType: "update",
      baseVersion: current.version,
      changedFields,
      payload: { ...input },
      failureMessage: `This financial account "${input.name ?? current.name}" could not be updated.`,
    });

    const row = await db.getFirstAsync<FinancialAccountRow>(
      "SELECT * FROM financial_accounts WHERE user_id = ? AND id = ?",
      userId,
      id,
    );

    result = { account: mapAccount(row!), operation };
  });

  return result!;
}

export async function deleteFinancialAccount(
  userId: string,
  deviceId: string,
  id: string,
): Promise<{ account: FinancialAccount; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { account: FinancialAccount; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<FinancialAccountRow>(
      "SELECT * FROM financial_accounts WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Financial account not found");

    await db.runAsync(
      `UPDATE financial_accounts SET status = 'deleted', deleted = 1, archived_at = ?,
       version = version + 1, updated_at = ? WHERE user_id = ? AND id = ?`,
      ts,
      ts,
      userId,
      id,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "financial_accounts",
      recordId: id,
      operationType: "delete",
      baseVersion: current.version,
      changedFields: [],
      payload: { id },
      failureMessage: `This financial account "${current.name}" could not be deleted.`,
    });

    const row = await db.getFirstAsync<FinancialAccountRow>(
      "SELECT * FROM financial_accounts WHERE user_id = ? AND id = ?",
      userId,
      id,
    );

    result = { account: mapAccount(row!), operation };
  });

  return result!;
}
