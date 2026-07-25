import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";

type DashboardSummary = {
  currentBalanceCentavos: number;
  currentMonthIncomeCentavos: number;
  currentMonthExpenseCentavos: number;
  previousMonthIncomeCentavos: number;
  previousMonthExpenseCentavos: number;
  recentTransactions: DashboardTransaction[];
};

type DashboardTransaction = {
  id: string;
  transaction_type: string;
  amount_centavos: number;
  transaction_date: string;
  merchant_name: string | null;
  counterparty_name: string | null;
};

const RECENT_LIMIT = 10;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = toLocalDateStr(new Date(year, month, 1));
  const end = toLocalDateStr(new Date(year, month + 1, 0));
  return { start, end };
}

function getPreviousMonthRange(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = toLocalDateStr(new Date(year, month - 1, 1));
  const end = toLocalDateStr(new Date(year, month, 0));
  return { start, end };
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const db = await getDb();

  const [balance, currentMonth, previousMonth, recentTransactions] = await Promise.all([
    db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(current_balance_centavos) AS total
       FROM financial_accounts
       WHERE user_id = ? AND deleted = 0 AND status = 'active' AND include_in_dashboard_balance = 1`,
      userId,
    ),
    db.getFirstAsync<{ income: number | null; expense: number | null }>(
      `SELECT
         SUM(CASE WHEN transaction_type = 'income' THEN amount_centavos ELSE 0 END) AS income,
         SUM(CASE WHEN transaction_type = 'expense' THEN amount_centavos ELSE 0 END) AS expense
       FROM transactions
       WHERE user_id = ? AND deleted = 0 AND status = 'posted'
         AND transaction_type IN ('income', 'expense')
         AND transaction_date >= ? AND transaction_date <= ?`,
      userId,
      getCurrentMonthRange().start,
      getCurrentMonthRange().end,
    ),
    db.getFirstAsync<{ income: number | null; expense: number | null }>(
      `SELECT
         SUM(CASE WHEN transaction_type = 'income' THEN amount_centavos ELSE 0 END) AS income,
         SUM(CASE WHEN transaction_type = 'expense' THEN amount_centavos ELSE 0 END) AS expense
       FROM transactions
       WHERE user_id = ? AND deleted = 0 AND status = 'posted'
         AND transaction_type IN ('income', 'expense')
         AND transaction_date >= ? AND transaction_date <= ?`,
      userId,
      getPreviousMonthRange().start,
      getPreviousMonthRange().end,
    ),
    db.getAllAsync<DashboardTransaction>(
      `SELECT id, transaction_type, amount_centavos, transaction_date, merchant_name, counterparty_name
       FROM transactions
       WHERE user_id = ? AND deleted = 0 AND status = 'posted'
       ORDER BY transaction_date DESC, created_at DESC
       LIMIT ?`,
      userId,
      RECENT_LIMIT,
    ),
  ]);

  return {
    currentBalanceCentavos: balance?.total ?? 0,
    currentMonthIncomeCentavos: currentMonth?.income ?? 0,
    currentMonthExpenseCentavos: currentMonth?.expense ?? 0,
    previousMonthIncomeCentavos: previousMonth?.income ?? 0,
    previousMonthExpenseCentavos: previousMonth?.expense ?? 0,
    recentTransactions: recentTransactions ?? [],
  };
}

export function _resetDbCacheForTesting(): void {
  dbPromise = null;
}

export type { DashboardSummary, DashboardTransaction };
