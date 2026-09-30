import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import type { ForecastTransaction } from "../../features/forecast/types";

const MAX_FORECAST_TRANSACTIONS = 500;
const MAX_DESCRIPTION_LENGTH = 160;
const MAX_RECOMMENDED_SUBCATEGORIES = 200;

type ForecastTransactionRow = {
  id: string;
  transaction_date: string;
  amount_centavos: number;
  transaction_type: "income" | "expense";
  merchant_name: string | null;
  counterparty_name: string | null;
  notes: string | null;
  category_slug: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function description(row: ForecastTransactionRow): string | undefined {
  const value = [row.merchant_name, row.counterparty_name, row.notes]
    .find((item) => typeof item === "string" && item.trim());
  return value?.trim().slice(0, MAX_DESCRIPTION_LENGTH) || undefined;
}

type ListForecastTransactionsOptions = {
  fromDate?: string;
};

export function getForecastHistoryStartDate(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1))
    .toISOString()
    .slice(0, 10);
}

export function getRecentExpenseStartDate(now = new Date()): string {
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - 6);
  return start.toISOString().slice(0, 10);
}

export async function listRecentExpenseSubcategoryIds(userId: string, fromDate = getRecentExpenseStartDate()): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ subcategory_id: string }>(
    `SELECT DISTINCT subcategory_id
       FROM transactions
      WHERE user_id = ? AND transaction_type = 'expense' AND status = 'posted' AND deleted = 0
        AND transaction_date >= ? AND subcategory_id IS NOT NULL
      ORDER BY subcategory_id
      LIMIT ${MAX_RECOMMENDED_SUBCATEGORIES}`,
    userId,
    fromDate,
  );
  return rows.flatMap((row) => typeof row.subcategory_id === "string" && row.subcategory_id ? [row.subcategory_id] : []);
}

export async function listForecastTransactions(userId: string, { fromDate }: ListForecastTransactionsOptions = {}): Promise<ForecastTransaction[]> {
  const db = await getDb();
  const fromDateClause = fromDate ? " AND t.transaction_date >= ?" : "";
  const rows = await db.getAllAsync<ForecastTransactionRow>(
    `SELECT t.id, t.transaction_date, t.amount_centavos, t.transaction_type, t.created_at,
            t.merchant_name, t.counterparty_name, t.notes,
            COALESCE(c.slug, 'Other') AS category_slug
       FROM transactions t
       LEFT JOIN subcategories s ON s.id = t.subcategory_id AND s.deleted = 0
       LEFT JOIN categories c ON c.id = s.category_id AND c.deleted = 0
       WHERE t.user_id = ? AND t.deleted = 0 AND t.status = 'posted'${fromDateClause}
          AND t.transaction_type IN ('income', 'expense')
       ORDER BY t.transaction_date DESC, t.created_at DESC
       LIMIT ${MAX_FORECAST_TRANSACTIONS}`,
    ...(fromDate ? [userId, fromDate] : [userId]),
  );
  return rows.reverse().flatMap((row) => {
    if (!Number.isInteger(row.amount_centavos) || row.amount_centavos <= 0) return [];
    const conciseDescription = description(row);
    return [{
      transactionId: row.id,
      date: row.transaction_date,
      amount: row.amount_centavos / 100,
      category: row.category_slug?.trim() || "Other",
      transactionType: row.transaction_type,
      ...(conciseDescription ? { description: conciseDescription } : {}),
    }];
  });
}

export function _resetDbCacheForTesting(): void {
  dbPromise = null;
}
