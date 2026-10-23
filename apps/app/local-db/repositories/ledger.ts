import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { validateSavingsGoalContribution, writeSavingsGoalContribution, type SavingsGoalContribution } from "./savingsGoalContributions";
import { readSavingsExpenseFunding, validateSavingsExpenseWithdrawals, replaceExpenseSavingsWithdrawals, type SavingsExpenseWithdrawal } from "./savingsExpenseFunding";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";
import { ensureCurrentCreditCardCycles } from "./creditCardCycles";
import { createCreditCardInstallmentInTransaction, type CreateCreditCardInstallmentInput } from "./creditCardInstallments";
import { validateIsoDate } from "./creditCardCycleDates";
import { createSavingsGoalActivityInTransaction, deleteSavingsGoalActivityForTransactionInTransaction, updateSavingsGoalActivityForTransactionInTransaction } from "./savingsGoalActivities";
import { deleteScheduledPaymentRecordForTransactionInTransaction } from "./scheduledPaymentRecords";

const VALID_TYPES = ["income", "expense", "transfer"] as const;
const VALID_SORT_BY = ["transaction_date", "amount_centavos", "created_at"] as const;
const VALID_SORT_DIR = ["asc", "desc"] as const;
const VALID_STATUSES = ["posted", "draft", "voided", "deleted"] as const;
const UPDATE_FIELDS = ["amount_centavos", "subcategory_id", "source_account_id", "destination_account_id", "transaction_date", "credit_card_posting_date", "merchant_name", "counterparty_name", "notes"] as const;

type TransactionRow = {
  id: string;
  user_id: string;
  transaction_type: string;
  status: string;
  entry_source: string;
  transaction_date: string;
  posted_at: string | null;
  credit_card_posting_date: string | null;
  amount_centavos: number;
  subcategory_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  destination_savings_goal_id?: string | null;
  source_savings_goal_id?: string | null;
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

type TransactionListRow = {
  id: string;
  name: string;
  category_label: string | null;
  icon_key: string | null;
  color_hex: string | null;
  financial_account_name: string | null;
  amount_centavos: number;
  transaction_date: string;
  transaction_type: string;
  // 1 when the transaction pays a biller or remittance.
  is_scheduled_payment: number;
  created_at: string;
  row_id: number;
};

export type Transaction = {
  id: string;
  transaction_type: string;
  status: string;
  entry_source: string;
  transaction_date: string;
  posted_at: string | null;
  credit_card_posting_date: string | null;
  amount_centavos: number;
  subcategory_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  destination_savings_goal_id?: string | null;
  source_savings_goal_id?: string | null;
  recurring_template_id: string | null;
  merchant_name: string | null;
  counterparty_name: string | null;
  notes: string | null;
  client_mutation_id: string | null;
};

export type TransactionListItem = TransactionListRow;

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
  savings_goal_withdrawals?: SavingsExpenseWithdrawal[];
  amount_centavos: number;
  source_account_id: string;
  subcategory_id: string;
  transaction_date: string;
  credit_card_posting_date?: string | null;
  merchant_name?: string;
  counterparty_name?: string;
  notes?: string;
  client_mutation_id?: string;
  installment?: CreateCreditCardInstallmentInput;
};

// Only a biller or remittance payment may be an uncategorized expense. It is marked by a client_mutation_id
// naming the scheduled payment; the server enforces the same rule.
export const BILLER_PAYMENT_MUTATION_PREFIX = "scheduled-payment:";
type ExpenseInsertInput = Omit<CreateExpenseInput, "subcategory_id"> & { subcategory_id: string | null };

export type CreateTransferInput = {
  amount_centavos: number;
  source_account_id: string;
  destination_account_id: string;
  transaction_date: string;
  notes?: string;
  source_savings_goal_id?: string | null;
  destination_savings_goal_id?: string | null;
};

export type UpdateTransactionInput = {
  savings_goal_withdrawals?: SavingsExpenseWithdrawal[];
  amount_centavos?: number;
  subcategory_id?: string;
  source_account_id?: string;
  destination_account_id?: string;
  transaction_date?: string;
  credit_card_posting_date?: string | null;
  merchant_name?: string;
  counterparty_name?: string;
  notes?: string;
};

export type TransactionFilters = {
  transaction_type?: string;
  category_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: string;
  limit?: number;
  offset?: number;
  // Keyset cursor: the last row of the previous page. Takes precedence over offset.
  after?: Pick<TransactionListItem, "transaction_date" | "amount_centavos" | "created_at" | "row_id">;
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
    credit_card_posting_date: row.credit_card_posting_date,
    amount_centavos: row.amount_centavos,
    subcategory_id: row.subcategory_id,
    source_account_id: row.source_account_id,
    destination_account_id: row.destination_account_id,
    destination_savings_goal_id: row.destination_savings_goal_id ?? null,
    source_savings_goal_id: row.source_savings_goal_id ?? null,
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

async function verifyOwnedAccount(
  db: SQLite.SQLiteDatabase,
  userId: string,
  accountId: string,
  label: string,
): Promise<void> {
  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM financial_accounts WHERE user_id = ? AND id = ?",
    userId,
    accountId,
  );
  if (!row) {
    throw new LocalDbError("VALIDATION_ERROR", `${label} not found or inaccessible`);
  }
}

async function verifyExpenseAccountCanBeUsed(
  db: SQLite.SQLiteDatabase,
  userId: string,
  accountId: string,
): Promise<boolean> {
  const card = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM financial_accounts WHERE user_id = ? AND id = ? AND kind = 'credit_card' AND deleted = 0",
    userId,
    accountId,
  );
  return Boolean(card);
}

async function verifySubcategoryOwnership(
  db: SQLite.SQLiteDatabase,
  userId: string,
  subcategoryId: string,
  kind?: string,
): Promise<void> {
  // ponytail: query subcategories inline, skip full repo import
  let sql = "SELECT id FROM subcategories WHERE user_id = ? AND id = ? AND deleted = 0 AND is_active = 1";
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
  input: ExpenseInsertInput,
): Promise<void> {
  validateAmount(input.amount_centavos);
  if (!input.source_account_id) {
    throw new LocalDbError("VALIDATION_ERROR", "source_account_id is required for expense");
  }
  if (!input.subcategory_id && !input.client_mutation_id?.startsWith(BILLER_PAYMENT_MUTATION_PREFIX)) {
    throw new LocalDbError("VALIDATION_ERROR", "subcategory_id is required for expense");
  }
  if (!input.transaction_date) {
    throw new LocalDbError("VALIDATION_ERROR", "transaction_date is required");
  }
  if ((input as Record<string, unknown>).destination_account_id != null) {
    throw new LocalDbError("VALIDATION_ERROR", "destination_account_id must not be set for expense");
  }
  await verifyAccountOwnership(db, userId, input.source_account_id, "source account");
  const isCreditCard = await verifyExpenseAccountCanBeUsed(db, userId, input.source_account_id);
  if (!isCreditCard && input.credit_card_posting_date != null) {
    throw new LocalDbError("VALIDATION_ERROR", "credit_card_posting_date is only valid for credit-card expenses");
  }
  if (!isCreditCard && input.installment) {
    throw new LocalDbError("VALIDATION_ERROR", "Installments can only be recorded on a credit card.");
  }
  if (input.installment && input.installment.original_principal_centavos !== input.amount_centavos) {
    throw new LocalDbError("VALIDATION_ERROR", "Installment original principal must match the transaction amount.");
  }
  if (input.credit_card_posting_date != null) validateIsoDate(input.credit_card_posting_date, "credit_card_posting_date");
  if (input.subcategory_id) await verifySubcategoryOwnership(db, userId, input.subcategory_id, "expense");
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
  destination_savings_goal_id?: string | null;
  source_savings_goal_id?: string | null;
  subcategory_id: string | null;
}> {
  const transactionType = current.transaction_type;
  const sourceId = input.source_account_id ?? current.source_account_id;
  const destId = input.destination_account_id ?? current.destination_account_id;
  const subId = input.subcategory_id ?? current.subcategory_id;

  if (input.amount_centavos != null) validateAmount(input.amount_centavos);

  if (sourceId != null) {
    await (input.source_account_id === undefined
      ? verifyOwnedAccount(db, userId, sourceId, "source account")
      : verifyAccountOwnership(db, userId, sourceId, "source account"));
  }
  if (destId != null) {
    await (input.destination_account_id === undefined
      ? verifyOwnedAccount(db, userId, destId, "destination account")
      : verifyAccountOwnership(db, userId, destId, "destination account"));
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
    await verifyExpenseAccountCanBeUsed(db, userId, sourceId);
    if (input.credit_card_posting_date != null) validateIsoDate(input.credit_card_posting_date, "credit_card_posting_date");
  } else if (transactionType === "transfer") {
    if (!sourceId || !destId) throw new LocalDbError("VALIDATION_ERROR", "both accounts are required for transfer");
    if (sourceId === destId && !current.destination_savings_goal_id) throw new LocalDbError("VALIDATION_ERROR", "source and destination accounts must differ");
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
  input: CreateIncomeInput | ExpenseInsertInput | CreateTransferInput,
  ts: string,
): { sql: string; params: SQLite.SQLiteBindValue[] } {
  const sourceAccountId = transactionType === "expense" || transactionType === "transfer" ? (input as CreateExpenseInput | CreateTransferInput).source_account_id : null;
  const destinationAccountId = transactionType === "income" || transactionType === "transfer" ? (input as CreateIncomeInput | CreateTransferInput).destination_account_id : null;
  const subcategoryId = transactionType === "income" || transactionType === "expense" ? (input as CreateIncomeInput | ExpenseInsertInput).subcategory_id : null;
  const merchantName = "merchant_name" in input ? input.merchant_name ?? null : null;
  const counterpartyName = "counterparty_name" in input ? input.counterparty_name ?? null : null;
  const notes = input.notes ?? null;
  const postingDate = transactionType === "expense" && "credit_card_posting_date" in input
    ? (input as ExpenseInsertInput).credit_card_posting_date ?? null
    : null;

  return {
    sql: `INSERT INTO transactions
       (id, user_id, transaction_type, status, entry_source, transaction_date, posted_at, credit_card_posting_date,
        amount_centavos, subcategory_id, source_account_id, destination_account_id, source_savings_goal_id, destination_savings_goal_id,
       recurring_template_id, merchant_name, counterparty_name, notes,
        client_mutation_id, metadata, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, 'posted', 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 1, 0, ?, ?)`,
    params: [
      id, userId, transactionType, input.transaction_date, ts, postingDate,
       input.amount_centavos, subcategoryId, sourceAccountId, destinationAccountId,
       "source_savings_goal_id" in input ? input.source_savings_goal_id ?? null : null,
       "destination_savings_goal_id" in input ? input.destination_savings_goal_id ?? null : null,
       null, merchantName, counterpartyName, notes,
       "client_mutation_id" in input ? input.client_mutation_id ?? null : null, ts, ts,
    ],
  };
}

// Shared by the list and its totals so both always cover the same rows.
function transactionFilterClauses(filters?: TransactionFilters): { parts: string[]; params: SQLite.SQLiteBindValue[] } {
  const parts: string[] = [];
  const params: SQLite.SQLiteBindValue[] = [];

  if (filters?.transaction_type) {
    if (!(VALID_TYPES as readonly string[]).includes(filters.transaction_type)) {
      throw new LocalDbError("VALIDATION_ERROR", `transaction_type must be one of: ${VALID_TYPES.join(", ")}`);
    }
    parts.push("AND t.transaction_type = ?");
    params.push(filters.transaction_type);
  }
  if (filters?.category_id) {
    parts.push("AND EXISTS (SELECT 1 FROM subcategories category_filter WHERE category_filter.id = t.subcategory_id AND category_filter.category_id = ? AND category_filter.deleted = 0 AND (category_filter.user_id = t.user_id OR category_filter.is_system = 1))");
    params.push(filters.category_id);
  }
  if (filters?.status) {
    if (!(VALID_STATUSES as readonly string[]).includes(filters.status)) {
      throw new LocalDbError("VALIDATION_ERROR", `status must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    parts.push("AND t.status = ?");
    params.push(filters.status);
  }
  if (filters?.from_date) {
    parts.push("AND t.transaction_date >= ?");
    params.push(filters.from_date);
  }
  if (filters?.to_date) {
    parts.push("AND t.transaction_date <= ?");
    params.push(filters.to_date);
  }
  if (filters?.search) {
    parts.push("AND (t.merchant_name LIKE ? OR t.counterparty_name LIKE ? OR t.notes LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  return { parts, params };
}

export type TransactionTotals = {
  income_centavos: number;
  expense_centavos: number;
};

export async function getTransactionTotals(
  userId: string,
  filters?: TransactionFilters,
): Promise<TransactionTotals> {
  const db = await getDb();
  const where = transactionFilterClauses(filters);
  const row = await db.getFirstAsync<TransactionTotals>(
    [`SELECT
      COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount_centavos END), 0) AS income_centavos,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount_centavos END), 0) AS expense_centavos
      FROM transactions t
      WHERE t.user_id = ? AND t.deleted = 0`, ...where.parts].join(" "),
    userId,
    ...where.params,
  );
  return row ?? { income_centavos: 0, expense_centavos: 0 };
}

export async function listTransactions(
  userId: string,
  filters?: TransactionFilters,
): Promise<TransactionListItem[]> {
  const db = await getDb();
  const parts: string[] = [`SELECT
    t.id,
    COALESCE('Contribution to ' || g.name, NULLIF(t.merchant_name, ''), NULLIF(t.counterparty_name, ''), NULLIF(t.notes, ''), s.label, 'Transaction') AS name,
    COALESCE(s.label, c.label) AS category_label,
    COALESCE(s.icon_key, c.icon_key) AS icon_key,
    COALESCE(s.color_hex, c.color_hex) AS color_hex,
    a.name AS financial_account_name,
    t.amount_centavos,
    t.transaction_date,
    t.transaction_type,
    EXISTS (SELECT 1 FROM scheduled_payment_records r WHERE r.user_id = t.user_id AND r.transaction_id = t.id AND r.deleted = 0) AS is_scheduled_payment,
    t.created_at,
    t.rowid AS row_id
    FROM transactions t
    LEFT JOIN savings_goals g ON g.id = t.destination_savings_goal_id AND g.user_id = t.user_id
    LEFT JOIN subcategories s ON s.id = t.subcategory_id AND s.deleted = 0 AND (s.user_id = t.user_id OR s.is_system = 1)
    LEFT JOIN categories c ON c.id = COALESCE(t.category_id, s.category_id) AND c.deleted = 0 AND (c.user_id = t.user_id OR c.is_system = 1)
    LEFT JOIN financial_accounts a ON a.id = CASE WHEN t.transaction_type = 'income' THEN t.destination_account_id ELSE t.source_account_id END AND a.user_id = t.user_id AND a.deleted = 0
    WHERE t.user_id = ? AND t.deleted = 0`];
  const params: SQLite.SQLiteBindValue[] = [userId];

  const where = transactionFilterClauses(filters);
  parts.push(...where.parts);
  params.push(...where.params);

  const sortBy = filters?.sort_by && (VALID_SORT_BY as readonly string[]).includes(filters.sort_by)
    ? filters.sort_by
    : "transaction_date";
  const sortDir = filters?.sort_dir && (VALID_SORT_DIR as readonly string[]).includes(filters.sort_dir)
    ? filters.sort_dir
    : "desc";

  // Seeking past the previous page's last row keeps deep pages as cheap as the first.
  if (filters?.after) {
    parts.push(`AND (t.${sortBy}, t.created_at, t.rowid) ${sortDir === "desc" ? "<" : ">"} (?, ?, ?)`);
    params.push(filters.after[sortBy as "transaction_date" | "amount_centavos" | "created_at"], filters.after.created_at, filters.after.row_id);
  }

  // rowid is implicit in the existing date index and keeps offset pages stable.
  parts.push(`ORDER BY t.${sortBy} ${sortDir}, t.created_at ${sortDir}, t.rowid ${sortDir}`);
  const requestedLimit = filters?.limit;
  const requestedOffset = filters?.offset;
  const limit = requestedLimit != null && Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(Math.trunc(requestedLimit), 200))
    : 100;
  const offset = !filters?.after && requestedOffset != null && Number.isFinite(requestedOffset)
    ? Math.max(0, Math.trunc(requestedOffset))
    : 0;
  // Expo SQLite on device rejects bound parameters in LIMIT/OFFSET.
  parts.push(`LIMIT ${limit} OFFSET ${offset}`);

  return db.getAllAsync<TransactionListRow>(parts.join(" "), ...params);
}

export type SavingsAccountMovement = {
  transactionId: string;
  kind: "contribution" | "withdrawal";
  amountCentavos: number;
  transactionDate: string;
};

export async function listSavingsAccountMovements(userId: string, accountId: string): Promise<SavingsAccountMovement[]> {
  const db = await getDb();
  return db.getAllAsync<SavingsAccountMovement>(
    `SELECT id AS transactionId,
      CASE WHEN destination_account_id = ? THEN 'contribution' ELSE 'withdrawal' END AS kind,
      amount_centavos AS amountCentavos, transaction_date AS transactionDate
     FROM transactions
     WHERE user_id = ? AND status = 'posted' AND deleted = 0
       AND source_account_id IS NOT destination_account_id
       AND ((destination_account_id = ? AND transaction_type IN ('income', 'transfer'))
         OR (source_account_id = ? AND transaction_type IN ('expense', 'transfer')))
     ORDER BY transaction_date ASC, created_at ASC`,
    accountId, userId, accountId, accountId,
  );
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

export async function createIncomeInTransaction(
  db: SQLite.SQLiteDatabase,
  userId: string,
  deviceId: string,
  input: CreateIncomeInput,
  options?: { id?: string },
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const ts = now();
  const id = options?.id ?? randomUUID();
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
  return { transaction: mapTransaction(row!), operation };
}

export async function createIncome(
  userId: string,
  deviceId: string,
  input: CreateIncomeInput,
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = await getDb();

  let result: { transaction: Transaction; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    result = await createIncomeInTransaction(db, userId, deviceId, input);
  });

  return result!;
}

export async function createExpenseInTransaction(
  db: SQLite.SQLiteDatabase,
  userId: string,
  deviceId: string,
  input: ExpenseInsertInput,
  options?: { id?: string },
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const ts = now();
  const id = options?.id ?? randomUUID();
  const isCreditCard = await verifyExpenseAccountCanBeUsed(db, userId, input.source_account_id);
  await validateExpenseShape(db, userId, input);
  const withdrawals = input.savings_goal_withdrawals ?? [];
  validateSavingsExpenseWithdrawals(await readSavingsExpenseFunding(db, userId, input.source_account_id, input.amount_centavos), withdrawals);
  if (!isCreditCard) {
    await applyBalanceEffects(db, userId, "expense", input.source_account_id, null, input.amount_centavos);
  }
  const { sql, params } = buildTransactionInsert(id, userId, "expense", input, ts);
  await db.runAsync(sql, ...params);
  await replaceExpenseSavingsWithdrawals(db, userId, id, withdrawals, input.transaction_date, input.notes ?? null);
  const { installment: _installment, ...transactionInput } = input;
  const operation = await enqueueOperation(db, {
    userId, deviceId, entity: "transactions", recordId: id, operationType: "create",
    baseVersion: null, changedFields: [],
     payload: { ...transactionInput, transaction_type: "expense", destination_account_id: null },
    failureMessage: "This expense transaction could not be created.",
  });
  if (isCreditCard) {
    const cycle = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM credit_card_cycles
        WHERE user_id = ? AND account_id = ? AND deleted = 0
          AND cycle_start_date <= ? AND cutoff_date >= ?
        ORDER BY cutoff_date ASC LIMIT 1`,
      userId,
      input.source_account_id,
      input.credit_card_posting_date ?? input.transaction_date,
      input.credit_card_posting_date ?? input.transaction_date,
    );
    if (!cycle) {
      throw new LocalDbError(
        "CREDIT_CARD_TRANSACTION_UNAVAILABLE",
        "Credit-card transactions cannot be recorded until billing-cycle routing is available.",
      );
    }
    const installment = input.installment
      ? await createCreditCardInstallmentInTransaction(
          db,
          userId,
          deviceId,
          input.source_account_id,
          id,
          input.installment,
          ts,
        )
      : null;
    const purchaseType = installment ? "installment" : "regular";
    await db.runAsync(
      `INSERT INTO credit_card_transactions
         (transaction_id, user_id, account_id, cycle_id, purchase_type, installment_id, forecast_recorded_at,
         client_mutation_id, applied_credit_centavos, version, deleted, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, ?, ?)`,
      id,
      userId,
      input.source_account_id,
      cycle.id,
      purchaseType,
       installment?.installment.id ?? null,
       ts,
      input.client_mutation_id ?? id,
      ts,
      ts,
    );
    await db.runAsync(
      `UPDATE credit_card_details
          SET available_credit_centavos = COALESCE(available_credit_centavos, credit_limit_centavos) - ?,
              version = version + 1,
              updated_at = ?
         WHERE account_id = ? AND user_id = ? AND deleted = 0
          `,
      input.amount_centavos,
      ts,
      input.source_account_id,
      userId,
    );
    await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "credit_card_transactions",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: ["transaction_id", "account_id", "cycle_id", "purchase_type", "installment_id", "forecast_recorded_at", "client_mutation_id"],
      payload: {
        transaction_id: id,
        account_id: input.source_account_id,
        cycle_id: cycle.id,
        purchase_type: purchaseType,
        installment_id: installment?.installment.id ?? null,
        forecast_recorded_at: ts,
        client_mutation_id: input.client_mutation_id ?? id,
      },
      failureMessage: "This credit-card transaction could not be recorded.",
    });
  }
  const row = await db.getFirstAsync<TransactionRow>("SELECT * FROM transactions WHERE user_id = ? AND id = ?", userId, id);
  return { transaction: mapTransaction(row!), operation };
}

export async function createExpense(
  userId: string,
  deviceId: string,
  input: CreateExpenseInput,
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = await getDb();

  const creditCard = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM financial_accounts WHERE user_id = ? AND id = ? AND kind = 'credit_card' AND status = 'active' AND deleted = 0",
    userId,
    input.source_account_id,
  );
  if (creditCard) {
    await ensureCurrentCreditCardCycles(userId, deviceId, input.credit_card_posting_date ?? input.transaction_date);
  }

  let result!: { transaction: Transaction; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    result = await createExpenseInTransaction(db, userId, deviceId, input);
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
  const id = randomUUID();

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

export async function createSavingsGoalTransfer(
  userId: string,
  deviceId: string,
  input: { savings_goal_id: string; kind: "contribution" | "withdrawal"; account_id: string; amount_centavos: number; transaction_date: string; notes?: string },
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  validateAmount(input.amount_centavos);
  validateIsoDate(input.transaction_date, "transaction_date");
  const db = await getDb(); const id = randomUUID(); const ts = now();
  let result!: { transaction: Transaction; operation: SyncOperation };
  await db.withTransactionAsync(async () => {
    if (input.kind !== "contribution" && input.kind !== "withdrawal") throw new LocalDbError("VALIDATION_ERROR", "Savings activity kind is invalid.");
    if (input.kind === "withdrawal") {
      const goal = await db.getFirstAsync<{ status: string }>("SELECT status FROM savings_goals WHERE id = ? AND user_id = ? AND deleted = 0", input.savings_goal_id, userId);
      if (!goal || goal.status !== "active") throw new LocalDbError("VALIDATION_ERROR", "Savings activities require an active savings goal.");
      await verifyAccountOwnership(db, userId, input.account_id, "financial account");
    }
    const sourceAccountId = input.kind === "contribution" ? input.account_id : null;
    const destinationAccountId = input.kind === "contribution"
      ? await validateSavingsGoalContribution(db, userId, input.savings_goal_id, input.account_id, input.amount_centavos)
      : input.account_id;
    const contribution: SavingsGoalContribution | null = input.kind === "contribution" ? { savings_goal_id: input.savings_goal_id, activity_id: randomUUID() } : null;
    const transactionInput: CreateTransferInput = { amount_centavos: input.amount_centavos, source_account_id: sourceAccountId ?? "", destination_account_id: destinationAccountId ?? "", transaction_date: input.transaction_date, notes: input.notes, source_savings_goal_id: input.kind === "withdrawal" ? input.savings_goal_id : null, destination_savings_goal_id: input.kind === "contribution" ? input.savings_goal_id : null };
    if (sourceAccountId) await applyBalanceEffects(db, userId, "expense", sourceAccountId, null, input.amount_centavos);
    if (destinationAccountId) await applyBalanceEffects(db, userId, "income", null, destinationAccountId, input.amount_centavos);
    const { sql, params } = buildTransactionInsert(id, userId, "transfer", transactionInput, ts);
    await db.runAsync(sql, ...params);
    const payload = {
      transaction_type: "transfer", transaction_date: input.transaction_date, amount_centavos: input.amount_centavos,
      source_account_id: sourceAccountId, destination_account_id: destinationAccountId, subcategory_id: null, notes: input.notes ?? null,
      ...(contribution ? { savings_goal_contribution: contribution } : {
        source_savings_goal_id: transactionInput.source_savings_goal_id, destination_savings_goal_id: transactionInput.destination_savings_goal_id,
      }),
    };
    const operation = await enqueueOperation(db, { userId, deviceId, entity: "transactions", recordId: id, operationType: "create", baseVersion: null, changedFields: [], payload, failureMessage: "This savings transfer could not be created." });
    if (contribution) await writeSavingsGoalContribution(db, userId, id, contribution, input.amount_centavos, input.transaction_date, input.notes ?? null);
    else await createSavingsGoalActivityInTransaction(db, userId, deviceId, { savingsGoalId: input.savings_goal_id, transactionId: id, kind: input.kind, amountCentavos: input.amount_centavos, activityDate: input.transaction_date, notes: input.notes });
    const row = await db.getFirstAsync<TransactionRow>("SELECT * FROM transactions WHERE user_id = ? AND id = ?", userId, id);
    result = { transaction: mapTransaction(row!), operation };
  });
  return result;
}

export async function updateTransaction(
  userId: string,
  deviceId: string,
  id: string,
  input: UpdateTransactionInput,
  options?: { allowStatementPayment?: boolean; allowDebtPayment?: boolean; db?: SQLite.SQLiteDatabase },
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = options?.db ?? await getDb();
  const ts = now();

  let result: { transaction: Transaction; operation: SyncOperation };

  const update = async () => {
    const current = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Transaction not found");
    if (!options?.allowStatementPayment && await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM credit_card_payments WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, id,
    )) throw new LocalDbError("VALIDATION_ERROR", "Edit this transaction from its credit-card statement payment.");
    if (!options?.allowDebtPayment && await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM debt_payments WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, id,
    )) throw new LocalDbError("VALIDATION_ERROR", "Edit this transaction from its debt payment.");
    if (await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM scheduled_payment_records WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, id,
    )) throw new LocalDbError("VALIDATION_ERROR", "This transaction pays a biller or remittance. Delete it and record the payment again.");
    const newShape = await validateUpdatedShape(db, userId, current, input);

    const newAmount = input.amount_centavos ?? current.amount_centavos;
    const cardPurchase = await db.getFirstAsync<{
      account_id: string;
      cycle_id: string;
      purchase_type: "regular" | "installment";
      version: number;
    }>(
      `SELECT account_id, cycle_id, purchase_type, version FROM credit_card_transactions
         WHERE transaction_id = ? AND user_id = ? AND deleted = 0`,
      id,
      userId,
    );
    if (cardPurchase?.purchase_type === "installment") {
      throw new LocalDbError("VALIDATION_ERROR", "Installment purchases cannot be edited. Record an issuer-recognized settlement separately when applicable.");
    }
    const cardAmountChanged = Boolean(cardPurchase && input.amount_centavos != null && input.amount_centavos !== current.amount_centavos);
    const newIsCreditCard = newShape.transaction_type === "expense" && newShape.source_account_id
      ? await verifyExpenseAccountCanBeUsed(db, userId, newShape.source_account_id)
      : false;
    if (cardPurchase && input.source_account_id !== undefined && input.source_account_id !== cardPurchase.account_id) {
      throw new LocalDbError(
        "VALIDATION_ERROR",
        "A credit-card purchase cannot be moved to another account after it is recorded.",
      );
    }
    if (!cardPurchase && newIsCreditCard) {
      throw new LocalDbError(
        "VALIDATION_ERROR",
        "Move a transaction to a credit card by recording it as a new credit-card purchase.",
      );
    }
    const effectiveDate = input.credit_card_posting_date === undefined
      ? current.credit_card_posting_date ?? input.transaction_date ?? current.transaction_date
      : input.credit_card_posting_date ?? input.transaction_date ?? current.transaction_date;
    let updatedCycleId: string | null = null;
    if (cardPurchase) {
      const cycle = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM credit_card_cycles
          WHERE user_id = ? AND account_id = ? AND deleted = 0
            AND cycle_start_date <= ? AND cutoff_date >= ?
          ORDER BY cutoff_date ASC LIMIT 1`,
        userId,
        cardPurchase.account_id,
        effectiveDate,
        effectiveDate,
      );
      if (!cycle) {
        throw new LocalDbError(
          "CREDIT_CARD_TRANSACTION_UNAVAILABLE",
          "The edited date is outside an available credit-card billing cycle.",
        );
      }
      updatedCycleId = cycle.id;
    }
    let contribution: SavingsGoalContribution | null = null;
    if (current.destination_savings_goal_id) {
      await validateSavingsGoalContribution(db, userId, current.destination_savings_goal_id, newShape.source_account_id!, newAmount, id, newShape.destination_account_id);
      const activity = await db.getFirstAsync<{ id: string }>("SELECT id FROM savings_goal_activities WHERE user_id = ? AND transaction_id = ? AND savings_goal_id = ? AND activity_kind = 'contribution' AND deleted = 0", userId, id, current.destination_savings_goal_id);
      if (!activity) throw new LocalDbError("VALIDATION_ERROR", "This contribution is unavailable.");
      contribution = { savings_goal_id: current.destination_savings_goal_id, activity_id: activity.id };
    }
    let expenseWithdrawals: SavingsExpenseWithdrawal[] | null = null;
    if (current.transaction_type === "expense") {
      const existing = await db.getAllAsync<{ savings_goal_id: string; amount_centavos: number }>(
        "SELECT savings_goal_id, amount_centavos FROM savings_goal_activities WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, id,
      );
      expenseWithdrawals = (input.savings_goal_withdrawals ?? existing).map((item) => ({ ...item, id: randomUUID() }));
      validateSavingsExpenseWithdrawals(await readSavingsExpenseFunding(db, userId, newShape.source_account_id!, newAmount, id), expenseWithdrawals);
    } else if (input.savings_goal_withdrawals?.length) {
      throw new LocalDbError("VALIDATION_ERROR", "Goal funding is only available for expenses.");
    }
    const balanceChanged =
      input.amount_centavos != null ||
      input.source_account_id != null ||
      input.destination_account_id != null;

    if (balanceChanged) {
      if (!cardPurchase) {
        await reverseBalanceEffects(
          db, userId,
          current.transaction_type,
          current.source_account_id,
          current.destination_account_id,
          current.amount_centavos,
        );
      }

      if (!newIsCreditCard) {
        await applyBalanceEffects(
          db, userId,
          newShape.transaction_type,
          newShape.source_account_id,
          newShape.destination_account_id,
          newAmount,
        );
      }
    }

    if (cardPurchase && cardAmountChanged) {
      await db.runAsync(
        `UPDATE credit_card_details
            SET available_credit_centavos = MIN(credit_limit_centavos,
              COALESCE(available_credit_centavos, credit_limit_centavos) + ? - ?),
                version = version + 1, updated_at = ?
          WHERE account_id = ? AND user_id = ? AND deleted = 0
          `,
        current.amount_centavos,
        newAmount,
        ts,
        cardPurchase.account_id,
        userId,
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

    if (!updates.length && expenseWithdrawals) {
      changedFields.push("notes"); updates.push("notes = ?"); params.push(current.notes);
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

    if (contribution) {
      await writeSavingsGoalContribution(db, userId, id, contribution, newAmount, input.transaction_date ?? current.transaction_date, input.notes ?? current.notes);
    } else if (expenseWithdrawals) {
      expenseWithdrawals = await replaceExpenseSavingsWithdrawals(db, userId, id, expenseWithdrawals, input.transaction_date ?? current.transaction_date, input.notes ?? current.notes);
    } else {
      await updateSavingsGoalActivityForTransactionInTransaction(db, userId, deviceId, id, {
        amountCentavos: newAmount, activityDate: input.transaction_date ?? current.transaction_date, notes: input.notes ?? current.notes,
      });
    }

    if (cardPurchase && updatedCycleId !== cardPurchase.cycle_id) {
      await db.runAsync(
        `UPDATE credit_card_transactions SET cycle_id = ?, version = version + 1, updated_at = ?
          WHERE transaction_id = ? AND user_id = ? AND deleted = 0`,
        updatedCycleId,
        ts,
        id,
        userId,
      );
      await enqueueOperation(db, {
        userId,
        deviceId,
        entity: "credit_card_transactions",
        recordId: id,
        operationType: "update",
        baseVersion: cardPurchase.version,
        changedFields: ["cycle_id"],
        payload: { cycle_id: updatedCycleId },
        failureMessage: "This credit-card transaction could not be moved to its billing cycle.",
      });
    }

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "transactions",
      recordId: id,
      operationType: "update",
      baseVersion: current.version,
      changedFields,
      payload: { ...input, ...(contribution ? { savings_goal_contribution: contribution } : {}), ...(expenseWithdrawals ? { savings_goal_withdrawals: expenseWithdrawals } : {}),
        ...(input.notes === undefined && changedFields.includes("notes") ? { notes: current.notes } : {}),
      },
      failureMessage: `This transaction could not be updated.`,
    });

    const row = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ?",
      userId,
      id,
    );
    result = { transaction: mapTransaction(row!), operation };
  };

  if (options?.db) await update();
  else await db.withTransactionAsync(update);

  return result!;
}

export async function deleteTransaction(
  userId: string,
  deviceId: string,
  id: string,
  options?: { allowStatementPayment?: boolean; allowDebtPayment?: boolean; db?: SQLite.SQLiteDatabase },
): Promise<{ transaction: Transaction; operation: SyncOperation }> {
  const db = options?.db ?? await getDb();
  const ts = now();

  let result: { transaction: Transaction; operation: SyncOperation };

  const remove = async () => {
    const current = await db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Transaction not found");
    if (!options?.allowStatementPayment && await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM credit_card_payments WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, id,
    )) throw new LocalDbError("VALIDATION_ERROR", "Delete this transaction from its credit-card statement payment.");
    if (!options?.allowDebtPayment && await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM debt_payments WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, id,
    )) throw new LocalDbError("VALIDATION_ERROR", "Delete this transaction from its debt payment.");
    const cardPurchase = await db.getFirstAsync<{
      account_id: string;
      amount_centavos: number;
      version: number;
    }>(
      `SELECT cct.account_id, cct.version, t.amount_centavos
         FROM credit_card_transactions cct
         JOIN transactions t ON t.id = cct.transaction_id AND t.user_id = cct.user_id
        WHERE cct.transaction_id = ? AND cct.user_id = ? AND cct.deleted = 0`,
      id,
      userId,
    );
    if (!cardPurchase) {
      await reverseBalanceEffects(
        db, userId,
        current.transaction_type,
        current.source_account_id,
        current.destination_account_id,
        current.amount_centavos,
      );
    }
    if (cardPurchase) {
      await db.runAsync(
        `UPDATE credit_card_details
            SET available_credit_centavos = MIN(credit_limit_centavos, COALESCE(available_credit_centavos, credit_limit_centavos) + ?),
                version = version + 1, updated_at = ?
          WHERE account_id = ? AND user_id = ? AND deleted = 0`,
        cardPurchase.amount_centavos,
        ts,
        cardPurchase.account_id,
        userId,
      );
      await db.runAsync(
        "UPDATE credit_card_transactions SET deleted = 1, version = version + 1, updated_at = ? WHERE transaction_id = ? AND user_id = ? AND deleted = 0",
        ts,
        id,
        userId,
      );
      await enqueueOperation(db, {
        userId,
        deviceId,
        entity: "credit_card_transactions",
        recordId: id,
        operationType: "delete",
        baseVersion: cardPurchase.version,
        changedFields: [],
        payload: { transaction_id: id },
        failureMessage: "This credit-card transaction could not be deleted.",
      });
    }

    await db.runAsync(
      "UPDATE transactions SET status = 'deleted', deleted = 1, version = version + 1, updated_at = ? WHERE user_id = ? AND id = ?",
      ts,
      userId,
      id,
    );

    if (current.transaction_type === "expense" || current.destination_savings_goal_id) {
      await replaceExpenseSavingsWithdrawals(db, userId, id, [], current.transaction_date, current.notes);
    } else {
      await deleteSavingsGoalActivityForTransactionInTransaction(db, userId, deviceId, id);
    }
    await deleteScheduledPaymentRecordForTransactionInTransaction(db, userId, deviceId, id);

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
  };

  if (options?.db) await remove();
  else await db.withTransactionAsync(remove);

  return result!;
}
