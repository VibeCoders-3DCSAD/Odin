import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";

const VALID_TYPES = ["income", "expense", "transfer"] as const;
const VALID_SORT_BY = ["transaction_date", "amount_centavos", "created_at"] as const;
const VALID_SORT_DIR = ["asc", "desc"] as const;
const VALID_STATUSES = ["posted", "draft", "voided", "deleted"] as const;
const UPDATE_FIELDS = ["amount_centavos", "subcategory_id", "source_account_id", "destination_account_id", "transaction_date", "merchant_name", "counterparty_name", "notes"] as const;

type TransactionRow = {
  id: string;
  user_id: string;
  transaction_type: string;
  status: string;
  entry_source: string;
  transaction_date: string;
  posted_at: string | null;
  amount_centavos: number;
  subcategory_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  recurring_template_id: string | null;
  merchant_name: string | null;
  counterparty_name: string | null;
  notes: string | null;
  client_mutation_id: string | null;
  metadata: string;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

export type Transaction = {
  id: string;
  transaction_type: string;
  status: string;
  entry_source: string;
  transaction_date: string;
  posted_at: string | null;
  amount_centavos: number;
  subcategory_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  recurring_template_id: string | null;
  merchant_name: string | null;
  counterparty_name: string | null;
  notes: string | null;
  client_mutation_id: string | null;
};

export type CreateIncomeInput = {
  amount_centavos: number;
  destination_account_id: string;
  subcategory_id: string;
  transaction_date: string;
  merchant_name?: string;
  counterparty_name?: string;
  notes?: string;
};

export type CreateExpenseInput = {
  amount_centavos: number;
  source_account_id: string;
  subcategory_id: string;
  transaction_date: string;
  merchant_name?: string;
  counterparty_name?: string;
  notes?: string;
};

export type CreateTransferInput = {
  amount_centavos: number;
  source_account_id: string;
  destination_account_id: string;
  transaction_date: string;
  notes?: string;
};

export type UpdateTransactionInput = {
  amount_centavos?: number;
  subcategory_id?: string;
  source_account_id?: string;
  destination_account_id?: string;
  transaction_date?: string;
  merchant_name?: string;
  counterparty_name?: string;
  notes?: string;
};

export type TransactionFilters = {
  transaction_type?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: string;
  limit?: number;
  offset?: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function now(): string {
  return new Date().toISOString();
}

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    transaction_type: row.transaction_type,
    status: row.status,
    entry_source: row.entry_source,
    transaction_date: row.transaction_date,
    posted_at: row.posted_at,
    amount_centavos: row.amount_centavos,
    subcategory_id: row.subcategory_id,
    source_account_id: row.source_account_id,
    destination_account_id: row.destination_account_id,
    recurring_template_id: row.recurring_template_id,
    merchant_name: row.merchant_name,
    counterparty_name: row.counterparty_name,
    notes: row.notes,
    client_mutation_id: row.client_mutation_id,
  };
}

async function verifyAccountOwnership(
  db: SQLite.SQLiteDatabase,
  userId: string,
  accountId: string,
  label: string,
): Promise<void> {
  // ponytail: query financial_accounts inline, skip full repo import
  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM financial_accounts WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    accountId,
  );
  if (!row) {
    throw new LocalDbError("VALIDATION_ERROR", `${label} not found or inaccessible`);
  }
}

async function verifySubcategoryOwnership(
  db: SQLite.SQLiteDatabase,
  userId: string,
  subcategoryId: string,
  kind?: string,
): Promise<void> {
  // ponytail: query subcategories inline, skip full repo import
  let sql = "SELECT id FROM subcategories WHERE user_id = ? AND id = ? AND deleted = 0";
  const params: SQLite.SQLiteBindValue[] = [userId, subcategoryId];
  if (kind) {
    sql += " AND kind = ?";
    params.push(kind);
  }
  const row = await db.getFirstAsync<{ id: string }>(sql, ...params);
  if (!row) {
    const msg = kind
      ? `subcategory not found or not a ${kind} subcategory`
      : "subcategory not found or inaccessible";
    throw new LocalDbError("VALIDATION_ERROR", msg);
  }
}

async function applyBalanceEffects(
  db: SQLite.SQLiteDatabase,
  userId: string,
  transactionType: string,
  sourceAccountId: string | null,
  destinationAccountId: string | null,
  amountCentavos: number,
): Promise<void> {
  if (transactionType === "income" && destinationAccountId) {
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos + ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      destinationAccountId,
      userId,
    );
  } else if (transactionType === "expense" && sourceAccountId) {
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos - ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      sourceAccountId,
      userId,
    );
  } else if (transactionType === "transfer" && sourceAccountId && destinationAccountId) {
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos - ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      sourceAccountId,
      userId,
    );
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos + ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      destinationAccountId,
      userId,
    );
  }
}

async function reverseBalanceEffects(
  db: SQLite.SQLiteDatabase,
  userId: string,
  transactionType: string,
  sourceAccountId: string | null,
  destinationAccountId: string | null,
  amountCentavos: number,
): Promise<void> {
  if (transactionType === "income" && destinationAccountId) {
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos - ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      destinationAccountId,
      userId,
    );
  } else if (transactionType === "expense" && sourceAccountId) {
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos + ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      sourceAccountId,
      userId,
    );
  } else if (transactionType === "transfer" && sourceAccountId && destinationAccountId) {
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos + ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      sourceAccountId,
      userId,
    );
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos - ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      destinationAccountId,
      userId,
    );
  }
}

function validateAmount(amount: number): void {
  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
    throw new LocalDbError("VALIDATION_ERROR", "amount_centavos must be a positive number");
  }
  if (!Number.isInteger(amount)) {
    throw new LocalDbError("VALIDATION_ERROR", "amount_centavos must be an integer");
  }
}

async function validateIncomeShape(
  db: SQLite.SQLiteDatabase,
  userId: string,
  input: CreateIncomeInput,
): Promise<void> {
  validateAmount(input.amount_centavos);
  if (!input.destination_account_id) {
    throw new LocalDbError("VALIDATION_ERROR", "destination_account_id is required for income");
  }
  if (!input.subcategory_id) {
    throw new LocalDbError("VALIDATION_ERROR", "subcategory_id is required for income");
  }
  if (!input.transaction_date) {
    throw new LocalDbError("VALIDATION_ERROR", "transaction_date is required");
  }
  if ((input as Record<string, unknown>).source_account_id != null) {
    throw new LocalDbError("VALIDATION_ERROR", "source_account_id must not be set for income");
  }
  await verifyAccountOwnership(db, userId, input.destination_account_id, "destination account");
  await verifySubcategoryOwnership(db, userId, input.subcategory_id, "income");
}

async function validateExpenseShape(
  db: SQLite.SQLiteDatabase,
  userId: string,
  input: CreateExpenseInput,
): Promise<void> {
  validateAmount(input.amount_centavos);
  if (!input.source_account_id) {
    throw new LocalDbError("VALIDATION_ERROR", "source_account_id is required for expense");
  }
  if (!input.subcategory_id) {
    throw new LocalDbError("VALIDATION_ERROR", "subcategory_id is required for expense");
  }
  if (!input.transaction_date) {
    throw new LocalDbError("VALIDATION_ERROR", "transaction_date is required");
  }
  if ((input as Record<string, unknown>).destination_account_id != null) {
    throw new LocalDbError("VALIDATION_ERROR", "destination_account_id must not be set for expense");
  }
  await verifyAccountOwnership(db, userId, input.source_account_id, "source account");
  await verifySubcategoryOwnership(db, userId, input.subcategory_id, "expense");
}

async function validateTransferShape(
  db: SQLite.SQLiteDatabase,
  userId: string,
  input: CreateTransferInput,
): Promise<void> {
  validateAmount(input.amount_centavos);
  if (!input.source_account_id) {
    throw new LocalDbError("VALIDATION_ERROR", "source_account_id is required for transfer");
  }
  if (!input.destination_account_id) {
    throw new LocalDbError("VALIDATION_ERROR", "destination_account_id is required for transfer");
  }
  if (input.source_account_id === input.destination_account_id) {
    throw new LocalDbError("VALIDATION_ERROR", "source and destination accounts must differ");
  }
  if (!input.transaction_date) {
    throw new LocalDbError("VALIDATION_ERROR", "transaction_date is required");
  }
  if ("subcategory_id" in input && (input as Record<string, unknown>).subcategory_id != null) {
    throw new LocalDbError("VALIDATION_ERROR", "subcategory_id must not be set for transfer");
  }
  await verifyAccountOwnership(db, userId, input.source_account_id, "source account");
  await verifyAccountOwnership(db, userId, input.destination_account_id, "destination account");
}

async function validateUpdatedShape(
  db: SQLite.SQLiteDatabase,
  userId: string,
  current: TransactionRow,
  input: UpdateTransactionInput,
): Promise<{
  transaction_type: string;
  source_account_id: string | null;
  destination_account_id: string | null;
  subcategory_id: string | null;
}> {
  const transactionType = current.transaction_type;
  const sourceId = input.source_account_id ?? current.source_account_id;
  const destId = input.destination_account_id ?? current.destination_account_id;
  const subId = input.subcategory_id ?? current.subcategory_id;

  if (input.amount_centavos != null) validateAmount(input.amount_centavos);

  if (sourceId != null) {
    await verifyAccountOwnership(db, userId, sourceId, "source account");
  }
  if (destId != null) {
    await verifyAccountOwnership(db, userId, destId, "destination account");
  }
  if (subId != null) {
    const subKind = transactionType === "income" ? "income" : "expense";
    await verifySubcategoryOwnership(db, userId, subId, subKind);
  }

  if (transactionType === "income") {
    if (!destId) throw new LocalDbError("VALIDATION_ERROR", "destination_account_id is required for income");
    if (sourceId != null) throw new LocalDbError("VALIDATION_ERROR", "source_account_id must be null for income");
    if (!subId) throw new LocalDbError("VALIDATION_ERROR", "subcategory_id is required for income");
  } else if (transactionType === "expense") {
    if (!sourceId) throw new LocalDbError("VALIDATION_ERROR", "source_account_id is required for expense");
    if (destId != null) throw new LocalDbError("VALIDATION_ERROR", "destination_account_id must be null for expense");
    if (!subId) throw new LocalDbError("VALIDATION_ERROR", "subcategory_id is required for expense");
  } else if (transactionType === "transfer") {
    if (!sourceId || !destId) throw new LocalDbError("VALIDATION_ERROR", "both accounts are required for transfer");
    if (sourceId === destId) throw new LocalDbError("VALIDATION_ERROR", "source and destination accounts must differ");
    if (subId != null) throw new LocalDbError("VALIDATION_ERROR", "subcategory_id must be null for transfer");
  }

  return {
    transaction_type: transactionType,
    source_account_id: sourceId,
    destination_account_id: destId,
    subcategory_id: subId,
  };
}

function buildTransactionInsert(
  id: string,
  userId: string,
  transactionType: string,
  input: CreateIncomeInput | CreateExpenseInput | CreateTransferInput,
  ts: string,
): { sql: string; params: SQLite.SQLiteBindValue[] } {
  const sourceAccountId =
    transactionType === "expense" || transactionType === "transfer"
      ? (input as Record<string, unknown>).source_account_id ?? null
      : null;
  const destinationAccountId =
    transactionType === "income" || transactionType === "transfer"
      ? (input as Record<string, unknown>).destination_account_id ?? null
      : null;
  const subcategoryId =
    transactionType === "income" || transactionType === "expense"
      ? (input as Record<string, unknown>).subcategory_id ?? null
      : null;
  const merchantName = (input as Record<string, unknown>).merchant_name ?? null;
  const counterpartyName = (input as Record<string, unknown>).counterparty_name ?? null;
  const notes = (input as Record<string, unknown>).notes ?? null;

  return {
    sql: `INSERT INTO transactions
      (id, user_id, transaction_type, status, entry_source, transaction_date, posted_at,
       amount_centavos, subcategory_id, source_account_id, destination_account_id,
       recurring_template_id, merchant_name, counterparty_name, notes,
       client_mutation_id, metadata, version, deleted, created_at, updated_at)
     VALUES (?, ?, ?, 'posted', 'manual', ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, '{}', 1, 0, ?, ?)`,
    params: [
      id, userId, transactionType, input.transaction_date, ts,
      input.amount_centavos, subcategoryId, sourceAccountId, destinationAccountId,
      merchantName, counterpartyName, notes, ts, ts,
    ],
  };
}

export async function listTransactions(
  userId: string,
  filters?: TransactionFilters,
): Promise<Transaction[]> {
  const db = await getDb();
  const parts: string[] = ["SELECT * FROM transactions WHERE user_id = ? AND deleted = 0"];
  const params: SQLite.SQLiteBindValue[] = [userId];

  if (filters?.transaction_type) {
    if (!(VALID_TYPES as readonly string[]).includes(filters.transaction_type)) {
      throw new LocalDbError("VALIDATION_ERROR", `transaction_type must be one of: ${VALID_TYPES.join(", ")}`);
    }
    parts.push("AND transaction_type = ?");
    params.push(filters.transaction_type);
  }
  if (filters?.status) {
    if (!(VALID_STATUSES as readonly string[]).includes(filters.status)) {
      throw new LocalDbError("VALIDATION_ERROR", `status must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    parts.push("AND status = ?");
    params.push(filters.status);
  }
  if (filters?.from_date) {
    parts.push("AND transaction_date >= ?");
    params.push(filters.from_date);
  }
  if (filters?.to_date) {
    parts.push("AND transaction_date <= ?");
    params.push(filters.to_date);
  }
  if (filters?.search) {
    parts.push("AND (merchant_name LIKE ? OR counterparty_name LIKE ? OR notes LIKE ? OR EXISTS (SELECT 1 FROM transaction_line_items tli WHERE tli.transaction_id = transactions.id AND tli.user_id = transactions.user_id AND tli.deleted = 0 AND tli.item_label LIKE ?))");
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }

  const sortBy = filters?.sort_by && (VALID_SORT_BY as readonly string[]).includes(filters.sort_by)
    ? filters.sort_by
    : "transaction_date";
  const sortDir = filters?.sort_dir && (VALID_SORT_DIR as readonly string[]).includes(filters.sort_dir)
    ? filters.sort_dir
    : "desc";

  parts.push(`ORDER BY ${sortBy} ${sortDir}`);
  parts.push("LIMIT ? OFFSET ?");
  params.push(Math.max(1, Math.min(filters?.limit ?? 100, 200)));
  params.push(Math.max(0, filters?.offset ?? 0));

  const rows = await db.getAllAsync<TransactionRow>(parts.join(" "), ...params);
  return rows.map(mapTransaction);
}

export async function getTransaction(
  userId: string,
  id: string,
): Promise<Transaction | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<TransactionRow>(
    "SELECT * FROM transactions WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    id,
  );
  return row ? mapTransaction(row) : null;
}

export async function createIncome(
  userId: string,
  deviceId: string,
  input: CreateIncomeInput,
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();
  const id = crypto.randomUUID();

  let result: { transaction: Transaction; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    await validateIncomeShape(db, userId, input);

    await applyBalanceEffects(
      db, userId, "income", null, input.destination_account_id, input.amount_centavos,
    );

    const { sql, params } = buildTransactionInsert(id, userId, "income", input, ts);
    await db.runAsync(sql, ...params);

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "transactions",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: [],
      payload: {
        ...input,
        transaction_type: "income",
        subcategory_id: input.subcategory_id,
        source_account_id: null,
        destination_account_id: input.destination_account_id,
      },
      failureMessage: `This income transaction could not be created.`,
    });

    const row = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ?",
      userId,
      id,
    );
    result = { transaction: mapTransaction(row!), operation };
  });

  return result!;
}

export async function createExpense(
  userId: string,
  deviceId: string,
  input: CreateExpenseInput,
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();
  const id = crypto.randomUUID();

  let result: { transaction: Transaction; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    await validateExpenseShape(db, userId, input);

    await applyBalanceEffects(
      db, userId, "expense", input.source_account_id, null, input.amount_centavos,
    );

    const { sql, params } = buildTransactionInsert(id, userId, "expense", input, ts);
    await db.runAsync(sql, ...params);

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "transactions",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: [],
      payload: {
        ...input,
        transaction_type: "expense",
        subcategory_id: input.subcategory_id,
        source_account_id: input.source_account_id,
        destination_account_id: null,
      },
      failureMessage: `This expense transaction could not be created.`,
    });

    const row = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ?",
      userId,
      id,
    );
    result = { transaction: mapTransaction(row!), operation };
  });

  return result!;
}

export async function createTransfer(
  userId: string,
  deviceId: string,
  input: CreateTransferInput,
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();
  const id = crypto.randomUUID();

  let result: { transaction: Transaction; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    await validateTransferShape(db, userId, input);

    await applyBalanceEffects(
      db, userId, "transfer", input.source_account_id, input.destination_account_id, input.amount_centavos,
    );

    const { sql, params } = buildTransactionInsert(id, userId, "transfer", input, ts);
    await db.runAsync(sql, ...params);

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "transactions",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: [],
      payload: {
        ...input,
        transaction_type: "transfer",
        subcategory_id: null,
        source_account_id: input.source_account_id,
        destination_account_id: input.destination_account_id,
      },
      failureMessage: `This transfer transaction could not be created.`,
    });

    const row = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ?",
      userId,
      id,
    );
    result = { transaction: mapTransaction(row!), operation };
  });

  return result!;
}

export async function updateTransaction(
  userId: string,
  deviceId: string,
  id: string,
  input: UpdateTransactionInput,
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { transaction: Transaction; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Transaction not found");

    const newShape = await validateUpdatedShape(db, userId, current, input);

    const newAmount = input.amount_centavos ?? current.amount_centavos;
    const balanceChanged =
      input.amount_centavos != null ||
      input.source_account_id != null ||
      input.destination_account_id != null;

    if (balanceChanged) {
      await reverseBalanceEffects(
        db, userId,
        current.transaction_type,
        current.source_account_id,
        current.destination_account_id,
        current.amount_centavos,
      );

      await applyBalanceEffects(
        db, userId,
        newShape.transaction_type,
        newShape.source_account_id,
        newShape.destination_account_id,
        newAmount,
      );
    }

    const updates: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];
    const changedFields: string[] = [];

    for (const key of UPDATE_FIELDS) {
      const value = (input as Record<string, unknown>)[key];
      if (value === undefined || value === null) continue;
      changedFields.push(key);
      updates.push(`${key} = ?`);
      params.push(value as SQLite.SQLiteBindValue);
    }

    if (updates.length > 0) {
      updates.push("updated_at = ?");
      params.push(ts);
      updates.push("version = version + 1");

      const sql = `UPDATE transactions SET ${updates.join(", ")} WHERE user_id = ? AND id = ?`;
      params.push(userId);
      params.push(id);
      await db.runAsync(sql, ...params);
    }

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "transactions",
      recordId: id,
      operationType: "update",
      baseVersion: current.version,
      changedFields,
      payload: { ...input },
      failureMessage: `This transaction could not be updated.`,
    });

    const row = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ?",
      userId,
      id,
    );
    result = { transaction: mapTransaction(row!), operation };
  });

  return result!;
}

export async function deleteTransaction(
  userId: string,
  deviceId: string,
  id: string,
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { transaction: Transaction; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Transaction not found");

    await reverseBalanceEffects(
      db, userId,
      current.transaction_type,
      current.source_account_id,
      current.destination_account_id,
      current.amount_centavos,
    );

    await db.runAsync(
      "UPDATE transactions SET status = 'deleted', deleted = 1, version = version + 1, updated_at = ? WHERE user_id = ? AND id = ?",
      ts,
      userId,
      id,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "transactions",
      recordId: id,
      operationType: "delete",
      baseVersion: current.version,
      changedFields: [],
      payload: { id },
      failureMessage: `This transaction could not be deleted.`,
    });

    const row = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ?",
      userId,
      id,
    );
    result = { transaction: mapTransaction(row!), operation };
  });

  return result!;
}
