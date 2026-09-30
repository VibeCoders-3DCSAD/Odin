import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";

export type ReportRange = { startDate: string; endDate: string };

export type CashFlowSummary = { incomeCentavos: number; expenseCentavos: number; netCashFlowCentavos: number };
export type AccountSummary = { accountCount: number; balanceCentavos: number };
export type BudgetActualSummary = { plannedCentavos: number; actualCentavos: number; varianceCentavos: number } | null;
export type SavingsSummary = { currentCentavos: number; targetCentavos: number };
export type DebtSummary = { openingCentavos: number; paidCentavos: number; remainingCentavos: number };
export type CategoryBreakdown = { label: string; amountCentavos: number };
export type AllocationSummary = { categoryCentavos: number; debtCentavos: number; savingsCentavos: number; unallocatedCentavos: number } | null;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= initDatabase();
  return dbPromise;
}

function periodPredicate(range: ReportRange): [string, string] {
  return [range.startDate, range.endDate];
}

export async function getCashFlowSummary(userId: string, range: ReportRange): Promise<CashFlowSummary> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ income: number | null; expense: number | null }>(
    `SELECT SUM(CASE WHEN transaction_type = 'income' THEN amount_centavos ELSE 0 END) AS income,
            SUM(CASE WHEN transaction_type = 'expense' THEN amount_centavos ELSE 0 END) AS expense
       FROM transactions
      WHERE user_id = ? AND deleted = 0 AND status = 'posted'
        AND transaction_type IN ('income', 'expense')
        AND transaction_date >= ? AND transaction_date <= ?`,
    userId, ...periodPredicate(range),
  );
  const incomeCentavos = row?.income ?? 0;
  const expenseCentavos = row?.expense ?? 0;
  return { incomeCentavos, expenseCentavos, netCashFlowCentavos: incomeCentavos - expenseCentavos };
}

export async function getCashFlowComparisonSummary(
  userId: string,
  range: ReportRange,
  averageByActiveMonth: boolean,
): Promise<CashFlowSummary> {
  if (!averageByActiveMonth) return getCashFlowSummary(userId, range);

  const db = await getDb();
  const row = await db.getFirstAsync<{ income: number | null; expense: number | null; activeMonths: number }>(
    `SELECT SUM(CASE WHEN transaction_type = 'income' THEN amount_centavos ELSE 0 END) AS income,
            SUM(CASE WHEN transaction_type = 'expense' THEN amount_centavos ELSE 0 END) AS expense,
            COUNT(DISTINCT substr(transaction_date, 1, 7)) AS activeMonths
       FROM transactions
      WHERE user_id = ? AND deleted = 0 AND status = 'posted'
        AND transaction_type IN ('income', 'expense')
        AND transaction_date >= ? AND transaction_date <= ?`,
    userId, ...periodPredicate(range),
  );
  const activeMonths = row?.activeMonths ?? 0;
  if (activeMonths === 0) return { incomeCentavos: 0, expenseCentavos: 0, netCashFlowCentavos: 0 };
  const incomeCentavos = Math.round((row?.income ?? 0) / activeMonths);
  const expenseCentavos = Math.round((row?.expense ?? 0) / activeMonths);
  return { incomeCentavos, expenseCentavos, netCashFlowCentavos: incomeCentavos - expenseCentavos };
}

export async function getAccountSummary(userId: string): Promise<AccountSummary> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number; total: number | null }>(
    `SELECT COUNT(*) AS count, SUM(current_balance_centavos) AS total
      FROM financial_accounts
      WHERE user_id = ? AND deleted = 0 AND status = 'active' AND kind <> 'credit_card'`,
    userId,
  );
  return { accountCount: row?.count ?? 0, balanceCentavos: row?.total ?? 0 };
}

export async function getAccountBalanceAt(userId: string, endDate: string): Promise<AccountSummary> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number; total: number | null }>(
    `SELECT COUNT(*) AS count,
            SUM(fa.current_balance_centavos - COALESCE((
              SELECT SUM(CASE
                WHEN t.transaction_type = 'income' AND t.destination_account_id = fa.id THEN t.amount_centavos
                WHEN t.transaction_type = 'expense' AND t.source_account_id = fa.id THEN -t.amount_centavos
                WHEN t.transaction_type = 'transfer' AND t.destination_account_id = fa.id THEN t.amount_centavos
                WHEN t.transaction_type = 'transfer' AND t.source_account_id = fa.id THEN -t.amount_centavos
                ELSE 0
              END)
                FROM transactions t
               WHERE t.user_id = fa.user_id AND t.deleted = 0 AND t.status = 'posted'
                 AND t.transaction_date > ? AND (t.source_account_id = fa.id OR t.destination_account_id = fa.id)
            ), 0)) AS total
       FROM financial_accounts fa
      WHERE fa.user_id = ? AND fa.deleted = 0 AND fa.status = 'active' AND fa.kind <> 'credit_card'
        AND substr(fa.created_at, 1, 10) <= ?`,
    endDate, userId, endDate,
  );
  return { accountCount: row?.count ?? 0, balanceCentavos: row?.total ?? 0 };
}

export async function getBudgetActualSummary(userId: string, range: ReportRange): Promise<BudgetActualSummary> {
  const db = await getDb();
  const plan = await db.getFirstAsync<{ total: number }>(
    `SELECT available_funds_centavos AS total FROM financial_plans
      WHERE user_id = ? AND deleted = 0 AND status = 'accepted'
        AND period_start <= ? AND period_end >= ?
      ORDER BY updated_at DESC LIMIT 1`,
    userId, range.endDate, range.startDate,
  );
  if (!plan) return null;
  const actual = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount_centavos) AS total FROM transactions
      WHERE user_id = ? AND deleted = 0 AND status = 'posted' AND transaction_type = 'expense'
        AND transaction_date >= ? AND transaction_date <= ?`,
    userId, ...periodPredicate(range),
  );
  const actualCentavos = actual?.total ?? 0;
  return { plannedCentavos: plan.total, actualCentavos, varianceCentavos: plan.total - actualCentavos };
}

export async function getSavingsSummary(userId: string): Promise<SavingsSummary> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ current: number | null; target: number | null }>(
    `SELECT SUM(g.starting_amount_centavos + COALESCE((
              SELECT SUM(CASE WHEN a.activity_kind = 'contribution' THEN a.amount_centavos ELSE -a.amount_centavos END)
              FROM savings_goal_activities a
              WHERE a.user_id = g.user_id AND a.savings_goal_id = g.id AND a.deleted = 0
            ), 0)) AS current,
            SUM(g.target_amount_centavos) AS target
       FROM savings_goals g
      WHERE g.user_id = ? AND g.deleted = 0 AND g.status IN ('active', 'archived')`,
    userId,
  );
  return { currentCentavos: row?.current ?? 0, targetCentavos: row?.target ?? 0 };
}

export async function getDebtSummary(userId: string): Promise<DebtSummary> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ opening: number | null; remaining: number | null }>(
    `SELECT SUM(original_balance_centavos) AS opening, SUM(current_balance_centavos) AS remaining
       FROM debt_accounts
      WHERE user_id = ? AND deleted = 0 AND status IN ('active', 'paid_off')`,
    userId,
  );
  const openingCentavos = row?.opening ?? 0;
  const remainingCentavos = row?.remaining ?? 0;
  return { openingCentavos, paidCentavos: Math.max(0, openingCentavos - remainingCentavos), remainingCentavos };
}

export async function listCategoryBreakdown(userId: string, range: ReportRange): Promise<CategoryBreakdown[]> {
  const db = await getDb();
  return db.getAllAsync<CategoryBreakdown>(
    `SELECT COALESCE(s.label, 'Uncategorised') AS label, SUM(t.amount_centavos) AS amountCentavos
       FROM transactions t
       LEFT JOIN subcategories s ON s.id = t.subcategory_id AND s.user_id = t.user_id AND s.deleted = 0
       WHERE t.user_id = ? AND t.deleted = 0 AND t.status = 'posted' AND t.transaction_type = 'expense'
         AND t.transaction_date >= ? AND t.transaction_date <= ?
       GROUP BY COALESCE(s.id, 'uncategorised'), COALESCE(s.label, 'Uncategorised')
       ORDER BY amountCentavos DESC LIMIT 5`,
    userId, ...periodPredicate(range),
  );
}

export async function getExpenseCategoryDistribution(userId: string, range: ReportRange): Promise<CategoryBreakdown[]> {
  const db = await getDb();
  const categories = await db.getAllAsync<CategoryBreakdown>(
    `SELECT COALESCE(s.label, 'Uncategorised') AS label, SUM(t.amount_centavos) AS amountCentavos
       FROM transactions t
       LEFT JOIN subcategories s ON s.id = t.subcategory_id AND s.user_id = t.user_id AND s.deleted = 0
       WHERE t.user_id = ? AND t.deleted = 0 AND t.status = 'posted' AND t.transaction_type = 'expense'
         AND t.transaction_date >= ? AND t.transaction_date <= ?
       GROUP BY COALESCE(s.id, 'uncategorised'), COALESCE(s.label, 'Uncategorised')
       ORDER BY amountCentavos DESC`,
    userId, ...periodPredicate(range),
  );
  const primaryCategories = categories.slice(0, 5);
  const otherCentavos = categories.slice(5).reduce((total, category) => total + category.amountCentavos, 0);
  return otherCentavos > 0 ? [...primaryCategories, { label: "Other", amountCentavos: otherCentavos }] : primaryCategories;
}

export async function getAllocationSummary(userId: string, range: ReportRange): Promise<AllocationSummary> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number; debt: number; savings: number; category: number | null }>(
    `SELECT p.available_funds_centavos AS total,
            (SELECT COALESCE(SUM(amount_centavos), 0) FROM financial_plan_debt_reservations WHERE plan_id = p.id) AS debt,
            (SELECT COALESCE(SUM(amount_centavos), 0) FROM financial_plan_savings_reservations WHERE plan_id = p.id) AS savings,
            (SELECT COALESCE(SUM(allocated_amount_centavos), 0) FROM financial_plan_allocations WHERE plan_id = p.id) AS category
       FROM financial_plans p
      WHERE p.user_id = ? AND p.deleted = 0 AND p.status = 'accepted'
        AND p.period_start <= ? AND p.period_end >= ?
      ORDER BY p.period_start DESC, p.updated_at DESC LIMIT 1`,
    userId, range.endDate, range.startDate,
  );
  if (!row) return null;
  const categoryCentavos = row.category ?? 0;
  return { categoryCentavos, debtCentavos: row.debt, savingsCentavos: row.savings, unallocatedCentavos: row.total - categoryCentavos - row.debt - row.savings };
}

export function _resetDbCacheForTesting(): void {
  dbPromise = null;
}
