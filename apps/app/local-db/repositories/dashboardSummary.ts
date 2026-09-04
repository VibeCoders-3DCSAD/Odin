import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";

type CategoryGroupSpending = {
  category_group_label: string;
  total_centavos: number;
};

type DashboardSummary = {
  currentBalanceCentavos: number;
  currentMonthIncomeCentavos: number;
  currentMonthExpenseCentavos: number;
  previousMonthIncomeCentavos: number;
  previousMonthExpenseCentavos: number;
  accountCount: number;
  incomeSourceCount: number;
  budgetCount: number;
  transactionCount: number;
  recentTransactions: DashboardTransaction[];
  categoryGroupSpending: CategoryGroupSpending[];
};

type DashboardTransaction = {
  id: string;
  transaction_type: string;
  amount_centavos: number;
  transaction_date: string;
  merchant_name: string | null;
  counterparty_name: string | null;
};

type DailyTrend = {
  date: string;
  expense_centavos: number;
  balance_centavos: number;
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
  const currentMonth = getCurrentMonthRange();
  const today = toLocalDateStr(new Date());

  const [balance, currentMonthTotals, previousMonth, accounts, incomeSources, transactions, budgets, recentTransactions, categoryGroupSpend] = await Promise.all([
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
      currentMonth.start,
      currentMonth.end,
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
    db.getFirstAsync<{ total: number }>(
      "SELECT COUNT(*) AS total FROM financial_accounts WHERE user_id = ? AND deleted = 0 AND status = 'active'",
      userId,
    ),
    db.getFirstAsync<{ total: number }>(
      "SELECT COUNT(*) AS total FROM income_sources WHERE user_id = ? AND deleted = 0",
      userId,
    ),
    db.getFirstAsync<{ total: number }>(
      "SELECT COUNT(*) AS total FROM transactions WHERE user_id = ? AND deleted = 0 AND status = 'posted' AND transaction_type IN ('income', 'expense')",
      userId,
    ),
    db.getFirstAsync<{ total: number }>(
      "SELECT COUNT(*) AS total FROM budgets WHERE user_id = ? AND deleted = 0 AND status IN ('draft', 'active') AND period_start <= ? AND period_end >= ?",
      userId,
      today,
      today,
    ),
    db.getAllAsync<DashboardTransaction>(
       `SELECT id, transaction_type, amount_centavos, transaction_date, merchant_name, counterparty_name
        FROM transactions
        WHERE user_id = ? AND deleted = 0 AND status = 'posted' AND transaction_type = 'expense'
        ORDER BY transaction_date DESC, created_at DESC
        LIMIT ${RECENT_LIMIT}`,
       userId,
     ),
    db.getAllAsync<CategoryGroupSpending>(
      `SELECT COALESCE(g.label, 'Other') AS category_group_label, SUM(t.amount_centavos) AS total_centavos
       FROM transactions t
       LEFT JOIN subcategories s ON t.subcategory_id = s.id
       LEFT JOIN categories c ON s.category_id = c.id
       LEFT JOIN category_groups g ON c.category_group_id = g.id
       WHERE t.user_id = ? AND t.deleted = 0 AND t.status = 'posted' AND t.transaction_type = 'expense'
         AND t.transaction_date >= ? AND t.transaction_date <= ?
       GROUP BY COALESCE(g.id, 'other'), COALESCE(g.label, 'Other')
       ORDER BY total_centavos DESC`,
      userId,
      currentMonth.start,
      currentMonth.end,
    ),
  ]);

  return {
    currentBalanceCentavos: balance?.total ?? 0,
    currentMonthIncomeCentavos: currentMonthTotals?.income ?? 0,
    currentMonthExpenseCentavos: currentMonthTotals?.expense ?? 0,
    previousMonthIncomeCentavos: previousMonth?.income ?? 0,
    previousMonthExpenseCentavos: previousMonth?.expense ?? 0,
    accountCount: accounts?.total ?? 0,
    incomeSourceCount: incomeSources?.total ?? 0,
    transactionCount: transactions?.total ?? 0,
    budgetCount: budgets?.total ?? 0,
    recentTransactions: recentTransactions ?? [],
    categoryGroupSpending: categoryGroupSpend ?? [],
  };
}

export async function getDailyTrends(userId: string): Promise<DailyTrend[]> {
  const db = await getDb();
  const { start, end } = getCurrentMonthRange();

  const rows = await db.getAllAsync<{ date: string; expense_centavos: number; cum_net: number }>(
    `WITH daily AS (
       SELECT transaction_date AS date,
              SUM(CASE WHEN transaction_type = 'expense' THEN amount_centavos ELSE 0 END) AS expense_centavos,
              SUM(CASE WHEN transaction_type = 'income' THEN amount_centavos ELSE 0 END)
              - SUM(CASE WHEN transaction_type = 'expense' THEN amount_centavos ELSE 0 END) AS net_centavos
       FROM transactions
       WHERE user_id = ? AND deleted = 0 AND status = 'posted'
         AND transaction_type IN ('income', 'expense')
         AND transaction_date >= ? AND transaction_date <= ?
       GROUP BY transaction_date
     )
     SELECT date, expense_centavos,
            SUM(net_centavos) OVER (ORDER BY date) AS cum_net
     FROM daily
     ORDER BY date ASC`,
    userId,
    start,
    end,
  );

  return (rows ?? []).map((r) => ({
    date: r.date,
    expense_centavos: r.expense_centavos,
    balance_centavos: r.cum_net,
  }));
}

export function _resetDbCacheForTesting(): void {
  dbPromise = null;
}

export type { DashboardSummary, DashboardTransaction, CategoryGroupSpending, DailyTrend };
