import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import type { ForecastTransaction } from "../../features/forecast/types";

const MAX_FORECAST_TRANSACTIONS = 500;
const MAX_DESCRIPTION_LENGTH = 160;

type ForecastTransactionRow = {
  id: string;
  transaction_date: string;
  amount_centavos: number;
  transaction_type: "income" | "expense";
  merchant_name: string | null;
  counterparty_name: string | null;
  notes: string | null;
  category_group_label: string | null;
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

export async function listForecastTransactions(userId: string): Promise<ForecastTransaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ForecastTransactionRow>(
    `SELECT t.id, t.transaction_date, t.amount_centavos, t.transaction_type,
            t.merchant_name, t.counterparty_name, t.notes,
            COALESCE(g.label, 'Other') AS category_group_label
       FROM transactions t
       LEFT JOIN subcategories s ON s.id = t.subcategory_id AND s.deleted = 0
       LEFT JOIN categories c ON c.id = s.category_id AND c.deleted = 0
       LEFT JOIN category_groups g ON g.id = c.category_group_id AND g.deleted = 0
      WHERE t.user_id = ? AND t.deleted = 0 AND t.status = 'posted'
        AND t.transaction_type IN ('income', 'expense')
      ORDER BY t.transaction_date ASC, t.created_at ASC
      LIMIT ${MAX_FORECAST_TRANSACTIONS}`,
    userId,
  );
  return rows.flatMap((row) => {
    if (!Number.isInteger(row.amount_centavos) || row.amount_centavos <= 0) return [];
    const conciseDescription = description(row);
    return [{
      transactionId: row.id,
      date: row.transaction_date,
      amount: row.amount_centavos / 100,
      category: row.category_group_label?.trim() || "Other",
      transactionType: row.transaction_type,
      ...(conciseDescription ? { description: conciseDescription } : {}),
    }];
  });
}

export function _resetDbCacheForTesting(): void {
  dbPromise = null;
}
