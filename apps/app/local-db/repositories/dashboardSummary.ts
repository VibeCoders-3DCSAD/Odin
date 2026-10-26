import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";

type CategorySpending = {
  category_id: string | null;
  category_label: string;
  icon_key: string | null;
  color_hex: string | null;
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
  categorySpending: CategorySpending[];
};

type DashboardTransaction = {
  id: string;
  transaction_type: string;
  amount_centavos: number;
  transaction_date: string;
  merchant_name: string | null;
  counterparty_name: string | null;
  category_label: string | null;
  icon_key: string | null;
  color_hex: string | null;
};

type DailyTrend = {
  date: string;
  expense_centavos: number;
  balance_centavos: number;
};

const RECENT_LIMIT = 10;

// Resolve both broad-category transactions and subcategory transactions within the owner boundary.
const TAXONOMY_JOINS = `
  LEFT JOIN subcategories s ON t.subcategory_id = s.id AND s.user_id = t.user_id
  LEFT JOIN categories c ON c.id = COALESCE(t.category_id, s.category_id) AND c.user_id = t.user_id
`;


function getDb(): Promise<SQLite.SQLiteDatabase> {
  return initDatabase();
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

  const [balance, currentMonthTotals, previousMonth, accounts, incomeSources, transactions, financialPlans, recentTransactions, categorySpend] = await Promise.all([
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
      "SELECT COUNT(*) AS total FROM financial_plans WHERE user_id = ? AND deleted = 0 AND status = 'accepted' AND period_start <= ? AND period_end >= ?",
      userId,
      today,
      today,
    ),
    db.getAllAsync<DashboardTransaction>(
       `SELECT t.id, t.transaction_type, t.amount_centavos, t.transaction_date, t.merchant_name, t.counterparty_name,
               COALESCE(s.label, c.label) AS category_label,
               COALESCE(s.icon_key, c.icon_key) AS icon_key,
               COALESCE(s.color_hex, c.color_hex) AS color_hex
        FROM transactions t
        ${TAXONOMY_JOINS}
        WHERE t.user_id = ? AND t.deleted = 0 AND t.status = 'posted' AND t.transaction_type = 'expense'
        ORDER BY t.transaction_date DESC, t.created_at DESC
        LIMIT ${RECENT_LIMIT}`,
       userId,
     ),
    db.getAllAsync<CategorySpending>(
      `WITH classified AS (
         SELECT t.amount_centavos, c.id AS category_id,
                COALESCE(c.label, 'Other') AS category_label, c.icon_key, c.color_hex,
                CASE
                  WHEN EXISTS (SELECT 1 FROM debt_payments dp
                               WHERE dp.transaction_id = t.id AND dp.user_id = t.user_id AND dp.deleted = 0)
                    OR EXISTS (SELECT 1 FROM credit_card_payments cp
                               WHERE cp.transaction_id = t.id AND cp.user_id = t.user_id AND cp.deleted = 0)
                    THEN 'debt'
                  WHEN t.destination_savings_goal_id IS NOT NULL THEN 'savings'
                  WHEN EXISTS (SELECT 1 FROM scheduled_payment_records spr
                               WHERE spr.transaction_id = t.id AND spr.user_id = t.user_id AND spr.deleted = 0)
                    THEN 'biller'
                  ELSE 'category'
                END AS kind
         FROM transactions t
         ${TAXONOMY_JOINS}
         WHERE t.user_id = ? AND t.deleted = 0 AND t.status = 'posted'
           AND (t.transaction_type = 'expense'
                OR (t.transaction_type = 'transfer' AND t.destination_savings_goal_id IS NOT NULL))
           AND t.transaction_date >= ? AND t.transaction_date <= ?
       ), spending AS (
         SELECT CASE WHEN kind = 'category' THEN category_id ELSE 'outflow:' || kind END AS category_id,
                CASE kind
                  WHEN 'debt' THEN 'Debt repayments'
                  WHEN 'savings' THEN 'Savings contributions'
                  WHEN 'biller' THEN 'Billers & remittances'
                  ELSE category_label
                END AS category_label,
                CASE kind
                  WHEN 'debt' THEN 'credit-card'
                  WHEN 'savings' THEN 'bank'
                  WHEN 'biller' THEN 'tag'
                  ELSE icon_key
                END AS icon_key,
                CASE kind
                  WHEN 'debt' THEN '#B45309'
                  WHEN 'savings' THEN '#15803D'
                  WHEN 'biller' THEN '#2563EB'
                  ELSE color_hex
                END AS color_hex,
                amount_centavos
         FROM classified
       )
       SELECT category_id, category_label, icon_key, color_hex, SUM(amount_centavos) AS total_centavos
       FROM spending
       GROUP BY category_id, category_label, icon_key, color_hex
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
    budgetCount: financialPlans?.total ?? 0,
    recentTransactions: recentTransactions ?? [],
    categorySpending: categorySpend ?? [],
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


export type { DashboardSummary, DashboardTransaction, CategorySpending, DailyTrend };
