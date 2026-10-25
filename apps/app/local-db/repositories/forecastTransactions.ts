import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import type { ForecastTransaction } from "../../features/forecast/types";
import { listSavedRecurrences, listUnusualSpendings, type SpendingRecurrence } from "./unusualSpending";
import { SCHEDULED_PAYMENTS_CATEGORY } from "../../features/forecast/scheduledForecast";

// Room for a full year of history, which the seasonal forecast compares against.
const MAX_FORECAST_TRANSACTIONS = 2_000;
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


function getDb(): Promise<SQLite.SQLiteDatabase> {
  return initDatabase();
}

function description(row: ForecastTransactionRow): string | undefined {
  const value = [row.merchant_name, row.counterparty_name, row.notes]
    .find((item) => typeof item === "string" && item.trim());
  return value?.trim().slice(0, MAX_DESCRIPTION_LENGTH) || undefined;
}

type ListForecastTransactionsOptions = {
  fromDate?: string;
  // Leave out biller and remittance payments, which the quarterly forecast adds back at their scheduled amounts.
  excludeScheduledPayments?: boolean;
  // Leave out purchases the personal IQR check flags unless the user said they will be frequent or yearly,
  // so the forecast does not expect a one-off again. Yearly ones are tagged to recur in their month.
  excludeUnusualSpending?: boolean;
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

export async function listRecentExpenseCategoryIds(userId: string, fromDate = getRecentExpenseStartDate()): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ category_id: string }>(
    `SELECT DISTINCT category_id
       FROM transactions
       WHERE user_id = ? AND transaction_type = 'expense' AND status = 'posted' AND deleted = 0
         AND transaction_date >= ? AND category_id IS NOT NULL AND subcategory_id IS NULL
       ORDER BY category_id
       LIMIT ${MAX_RECOMMENDED_SUBCATEGORIES}`,
    userId,
    fromDate,
  );
  return rows.flatMap((row) => typeof row.category_id === "string" && row.category_id ? [row.category_id] : []);
}

export async function listRecentExpenseSubcategoryIds(userId: string, fromDate = getRecentExpenseStartDate()): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ subcategory_id: string }>(
    `SELECT DISTINCT subcategory_id FROM transactions WHERE user_id = ? AND transaction_type = 'expense' AND status = 'posted' AND deleted = 0 AND transaction_date >= ? AND subcategory_id IS NOT NULL ORDER BY subcategory_id LIMIT ${MAX_RECOMMENDED_SUBCATEGORIES}`,
    userId, fromDate,
  );
  return rows.flatMap((row) => typeof row.subcategory_id === "string" && row.subcategory_id ? [row.subcategory_id] : []);
}

export async function listForecastTransactions(userId: string, { fromDate, excludeScheduledPayments = false, excludeUnusualSpending = false }: ListForecastTransactionsOptions = {}): Promise<ForecastTransaction[]> {
  const db = await getDb();
  const fromDateClause = fromDate ? " AND t.transaction_date >= ?" : "";
  const scheduledClause = excludeScheduledPayments
    ? " AND NOT EXISTS (SELECT 1 FROM scheduled_payment_records r WHERE r.user_id = t.user_id AND r.transaction_id = t.id AND r.deleted = 0)"
    : "";
  const rows = await db.getAllAsync<ForecastTransactionRow>(
    `SELECT t.id, t.transaction_date, t.amount_centavos, t.transaction_type, t.created_at,
            t.merchant_name, t.counterparty_name, t.notes,
            COALESCE(c.slug, 'Other') AS category_slug
       FROM transactions t
       LEFT JOIN subcategories s ON s.id = t.subcategory_id AND s.deleted = 0
       LEFT JOIN categories c ON c.id = s.category_id AND c.deleted = 0
       WHERE t.user_id = ? AND t.deleted = 0 AND t.status = 'posted'${fromDateClause}${scheduledClause}
          AND t.transaction_type IN ('income', 'expense')
       ORDER BY t.transaction_date DESC, t.created_at DESC
       LIMIT ${MAX_FORECAST_TRANSACTIONS}`,
    ...(fromDate ? [userId, fromDate] : [userId]),
  );
  // Saved answers decide what recurs, so a payment the check no longer flags keeps its answer.
  const [detected, saved] = excludeUnusualSpending
    ? await Promise.all([listUnusualSpendings(userId), listSavedRecurrences(userId)])
    : [[], new Map<string, SpendingRecurrence | null>()];
  const recurs = (id: string) => saved.get(id) === "frequent" || saved.get(id) === "yearly";
  const oneOffs = new Set([...detected.map((insight) => insight.transactionId), ...saved.keys()].filter((id) => !recurs(id)));
  const yearly = new Set([...saved].flatMap(([id, recurrence]) => recurrence === "yearly" ? [id] : []));
  return rows.reverse().flatMap((row) => {
    if (!Number.isInteger(row.amount_centavos) || row.amount_centavos <= 0 || oneOffs.has(row.id)) return [];
    const conciseDescription = description(row);
    return [{
      transactionId: row.id,
      date: row.transaction_date,
      amount: row.amount_centavos / 100,
      category: row.category_slug?.trim() || "Other",
      transactionType: row.transaction_type,
      ...(conciseDescription ? { description: conciseDescription } : {}),
      ...(yearly.has(row.id) ? { recurrence: "yearly" as const } : {}),
    }];
  });
}

export type QuarterSpending = { quarter: string; totalCentavos: number; categories: { category: string; amountCentavos: number }[] };

// The quarters (YYYYQn) that end before the current quarter, oldest first.
export function pastQuarters(count: number, now = new Date()): string[] {
  const current = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
  return Array.from({ length: count }, (_, index) => {
    const quarter = current - count + index;
    return `${Math.floor(quarter / 4)}Q${(quarter % 4) + 1}`;
  });
}

// Actual spending per quarter in the same groups the forecast uses: HFCE categories, with biller and
// remittance payments in their own group. Debt repayments and savings transfers have no category and are left out.
export async function listQuarterlySpending(userId: string, quarters: string[]): Promise<QuarterSpending[]> {
  if (quarters.length === 0) return [];
  const first = quarters[0]!;
  const last = quarters.at(-1)!;
  const startDate = `${first.slice(0, 4)}-${String((Number(first.slice(5)) - 1) * 3 + 1).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(Number(last.slice(0, 4)), Number(last.slice(5)) * 3, 0)).toISOString().slice(0, 10);
  const db = await getDb();
  const rows = await db.getAllAsync<{ quarter: string; category: string; amount_centavos: number }>(
    `SELECT substr(t.transaction_date, 1, 4) || 'Q' || ((CAST(substr(t.transaction_date, 6, 2) AS INTEGER) + 2) / 3) AS quarter,
            CASE WHEN EXISTS (SELECT 1 FROM scheduled_payment_records r WHERE r.user_id = t.user_id AND r.transaction_id = t.id AND r.deleted = 0)
                 THEN '${SCHEDULED_PAYMENTS_CATEGORY}' ELSE c.slug END AS category,
            SUM(t.amount_centavos) AS amount_centavos
       FROM transactions t
       LEFT JOIN subcategories s ON s.id = t.subcategory_id AND s.deleted = 0
       LEFT JOIN categories c ON c.id = s.category_id AND c.deleted = 0
      WHERE t.user_id = ? AND t.deleted = 0 AND t.status = 'posted' AND t.transaction_type = 'expense'
        AND t.amount_centavos > 0 AND t.transaction_date >= ? AND t.transaction_date <= ?
      GROUP BY quarter, category
     HAVING category IS NOT NULL`,
    userId, startDate, endDate,
  );
  return quarters.map((quarter) => {
    const categories = rows.filter((row) => row.quarter === quarter).map((row) => ({ category: row.category, amountCentavos: row.amount_centavos }));
    return { quarter, totalCentavos: categories.reduce((sum, point) => sum + point.amountCentavos, 0), categories };
  });
}
