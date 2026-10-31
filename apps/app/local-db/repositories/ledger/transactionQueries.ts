import * as SQLite from "expo-sqlite";
import { LocalDbError } from "../../helpers";
import { getDb } from "../helpers/db";
import { mapTransaction, type TransactionRow } from "./transactionRows";
import type { Transaction, TransactionFilters, TransactionListItem, TransactionListRow } from "./transactionTypes";

const VALID_TYPES = ["income", "expense", "transfer"] as const;
const VALID_SORT_BY = ["transaction_date", "amount_centavos", "created_at"] as const;
const VALID_SORT_DIR = ["asc", "desc"] as const;
const VALID_STATUSES = ["posted", "draft", "voided", "deleted"] as const;

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
