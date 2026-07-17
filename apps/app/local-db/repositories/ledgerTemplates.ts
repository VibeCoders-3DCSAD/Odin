import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";

type TemplateRow = {
  id: string;
  user_id: string;
  transaction_type: string;
  status: string;
  name: string;
  amount_centavos: number | null;
  subcategory_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  merchant_name: string | null;
  counterparty_name: string | null;
  notes: string | null;
  use_count: number;
  last_used_at: string | null;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

type DraftRow = {
  id: string;
  user_id: string;
  client_draft_id: string;
  status: string;
  payload: string;
  captured_offline_at: string | null;
  synced_transaction_id: string | null;
  last_error: string | null;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

export type TransactionTemplate = {
  id: string;
  transaction_type: string;
  status: string;
  name: string;
  amount_centavos: number | null;
  subcategory_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  merchant_name: string | null;
  counterparty_name: string | null;
  notes: string | null;
  use_count: number;
  last_used_at: string | null;
};

export type TransactionDraft = {
  id: string;
  client_draft_id: string;
  status: string;
  payload: Record<string, unknown>;
  captured_offline_at: string | null;
  synced_transaction_id: string | null;
  last_error: string | null;
};

export type CreateTemplateInput = {
  transaction_type: string;
  name: string;
  amount_centavos?: number;
  subcategory_id?: string;
  source_account_id?: string;
  destination_account_id?: string;
  merchant_name?: string;
  counterparty_name?: string;
  notes?: string;
};

export type UpdateTemplateInput = {
  name?: string;
  amount_centavos?: number;
  subcategory_id?: string | null;
  source_account_id?: string | null;
  destination_account_id?: string | null;
  merchant_name?: string | null;
  counterparty_name?: string | null;
  notes?: string | null;
};

export type SaveDraftInput = {
  client_draft_id: string;
  payload: Record<string, unknown>;
  captured_offline_at?: string;
};

const VALID_TYPES = ["income", "expense", "transfer"] as const;
const VALID_TEMPLATE_STATUSES = ["active", "archived", "deleted"] as const;
const VALID_DRAFT_STATUSES = ["pending", "synced", "discarded"] as const;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function now(): string {
  return new Date().toISOString();
}

function mapTemplate(row: TemplateRow): TransactionTemplate {
  return {
    id: row.id,
    transaction_type: row.transaction_type,
    status: row.status,
    name: row.name,
    amount_centavos: row.amount_centavos,
    subcategory_id: row.subcategory_id,
    source_account_id: row.source_account_id,
    destination_account_id: row.destination_account_id,
    merchant_name: row.merchant_name,
    counterparty_name: row.counterparty_name,
    notes: row.notes,
    use_count: row.use_count,
    last_used_at: row.last_used_at,
  };
}

function mapDraft(row: DraftRow): TransactionDraft {
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(row.payload); } catch {}
  return {
    id: row.id,
    client_draft_id: row.client_draft_id,
    status: row.status,
    payload,
    captured_offline_at: row.captured_offline_at,
    synced_transaction_id: row.synced_transaction_id,
    last_error: row.last_error,
  };
}

export async function listTemplates(userId: string): Promise<TransactionTemplate[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TemplateRow>(
    "SELECT * FROM transaction_templates WHERE user_id = ? AND deleted = 0 AND status = 'active' ORDER BY last_used_at DESC",
    userId,
  );
  return rows.map(mapTemplate);
}

export async function getTemplate(userId: string, id: string): Promise<TransactionTemplate | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<TemplateRow>(
    "SELECT * FROM transaction_templates WHERE user_id = ? AND id = ? AND deleted = 0",
    userId, id,
  );
  return row ? mapTemplate(row) : null;
}

export async function createTemplate(
  userId: string,
  deviceId: string,
  input: CreateTemplateInput,
): Promise<{ template: TransactionTemplate; operation: SyncOperation }> {
  if (!input.name?.trim()) throw new LocalDbError("VALIDATION_ERROR", "name is required");
  if (!(VALID_TYPES as readonly string[]).includes(input.transaction_type)) {
    throw new LocalDbError("VALIDATION_ERROR", `transaction_type must be one of: ${VALID_TYPES.join(", ")}`);
  }

  const db = await getDb();
  const id = randomUUID();
  const ts = now();

  let result: { template: TransactionTemplate; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transaction_templates
        (id, user_id, transaction_type, status, name, amount_centavos, subcategory_id,
         source_account_id, destination_account_id, merchant_name, counterparty_name, notes,
         use_count, metadata, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, 0, '{}', 1, 0, ?, ?)`,
      id, userId, input.transaction_type, input.name.trim(),
      input.amount_centavos ?? null, input.subcategory_id ?? null,
      input.source_account_id ?? null, input.destination_account_id ?? null,
      input.merchant_name ?? null, input.counterparty_name ?? null,
      input.notes ?? null, ts, ts,
    );

    const operation = await enqueueOperation(db, {
      userId, deviceId,
      entity: "transaction_templates",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: [],
      payload: { ...input, name: input.name.trim() },
      failureMessage: `This template "${input.name.trim()}" could not be created.`,
    });

    const row = await db.getFirstAsync<TemplateRow>(
      "SELECT * FROM transaction_templates WHERE user_id = ? AND id = ?", userId, id,
    );
    result = { template: mapTemplate(row!), operation };
  });

  return result!;
}

export async function updateTemplate(
  userId: string,
  deviceId: string,
  id: string,
  input: UpdateTemplateInput,
): Promise<{ template: TransactionTemplate; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { template: TransactionTemplate; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<TemplateRow>(
      "SELECT * FROM transaction_templates WHERE user_id = ? AND id = ? AND deleted = 0",
      userId, id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Template not found");

    const updates: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];
    const changedFields: string[] = [];
    const fields = ["name", "amount_centavos", "subcategory_id", "source_account_id", "destination_account_id", "merchant_name", "counterparty_name", "notes"] as const;

    for (const key of fields) {
      const value = (input as Record<string, unknown>)[key];
      if (value === undefined) continue;
      changedFields.push(key);
      updates.push(`${key} = ?`);
      params.push(value as SQLite.SQLiteBindValue);
    }

    if (updates.length > 0) {
      updates.push("updated_at = ?");
      params.push(ts);
      updates.push("version = version + 1");
      const sql = `UPDATE transaction_templates SET ${updates.join(", ")} WHERE user_id = ? AND id = ?`;
      params.push(userId, id);
      await db.runAsync(sql, ...params);
    }

    const operation = await enqueueOperation(db, {
      userId, deviceId,
      entity: "transaction_templates",
      recordId: id,
      operationType: "update",
      baseVersion: current.version,
      changedFields,
      payload: { ...input },
      failureMessage: `This template "${input.name ?? current.name}" could not be updated.`,
    });

    const row = await db.getFirstAsync<TemplateRow>(
      "SELECT * FROM transaction_templates WHERE user_id = ? AND id = ?", userId, id,
    );
    result = { template: mapTemplate(row!), operation };
  });

  return result!;
}

export async function deleteTemplate(
  userId: string,
  deviceId: string,
  id: string,
): Promise<{ template: TransactionTemplate; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { template: TransactionTemplate; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<TemplateRow>(
      "SELECT * FROM transaction_templates WHERE user_id = ? AND id = ? AND deleted = 0",
      userId, id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Template not found");

    await db.runAsync(
      "UPDATE transaction_templates SET status = 'deleted', deleted = 1, version = version + 1, updated_at = ? WHERE user_id = ? AND id = ?",
      ts, userId, id,
    );

    const operation = await enqueueOperation(db, {
      userId, deviceId,
      entity: "transaction_templates",
      recordId: id,
      operationType: "delete",
      baseVersion: current.version,
      changedFields: [],
      payload: { id },
      failureMessage: `This template "${current.name}" could not be deleted.`,
    });

    const row = await db.getFirstAsync<TemplateRow>(
      "SELECT * FROM transaction_templates WHERE user_id = ? AND id = ?", userId, id,
    );
    result = { template: mapTemplate(row!), operation };
  });

  return result!;
}

// Drafts
export async function listDrafts(userId: string): Promise<TransactionDraft[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DraftRow>(
    "SELECT * FROM transaction_drafts WHERE user_id = ? AND deleted = 0 AND status = 'pending' ORDER BY created_at DESC",
    userId,
  );
  return rows.map(mapDraft);
}

export async function saveDraft(
  userId: string,
  deviceId: string,
  input: SaveDraftInput,
): Promise<TransactionDraft> {
  const db = await getDb();
  const id = randomUUID();
  const ts = now();

  let result: TransactionDraft;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transaction_drafts
        (id, user_id, client_draft_id, status, payload, captured_offline_at, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?, 1, 0, ?, ?)`,
      id, userId, input.client_draft_id,
      JSON.stringify(input.payload),
      input.captured_offline_at ?? null,
      ts, ts,
    );

    await enqueueOperation(db, {
      userId, deviceId,
      entity: "transaction_drafts",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: [],
      payload: {
        client_draft_id: input.client_draft_id,
        payload: input.payload,
        captured_offline_at: input.captured_offline_at,
      },
      failureMessage: `This draft could not be created.`,
    });

    const row = await db.getFirstAsync<DraftRow>(
      "SELECT * FROM transaction_drafts WHERE user_id = ? AND id = ?", userId, id,
    );
    result = mapDraft(row!);
  });

  return result!;
}

export async function deleteDraft(userId: string, deviceId: string, id: string): Promise<void> {
  const db = await getDb();
  const ts = now();

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<DraftRow>(
      "SELECT * FROM transaction_drafts WHERE user_id = ? AND id = ? AND deleted = 0",
      userId, id,
    );
    if (!current) return;

    await db.runAsync(
      "UPDATE transaction_drafts SET status = 'discarded', deleted = 1, version = version + 1, updated_at = ? WHERE user_id = ? AND id = ?",
      ts, userId, id,
    );

    await enqueueOperation(db, {
      userId, deviceId,
      entity: "transaction_drafts",
      recordId: id,
      operationType: "delete",
      baseVersion: current.version,
      changedFields: [],
      payload: { id },
      failureMessage: `This draft could not be deleted.`,
    });
  });
}
