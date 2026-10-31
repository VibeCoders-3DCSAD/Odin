import { getDb } from "./helpers/db";

export type ReportRange = { startDate: string; endDate: string };

export type CashFlowSummary = { incomeCentavos: number; outflowCentavos: number; netCashFlowCentavos: number };
export type AccountSummary = { accountCount: number; balanceCentavos: number };
export type BudgetActualSummary = { plannedCentavos: number; actualCentavos: number; varianceCentavos: number } | null;
export type SavingsSummary = { currentCentavos: number; targetCentavos: number };
export type DebtSummary = { openingCentavos: number; paidCentavos: number; remainingCentavos: number };
export type CategoryBreakdown = { label: string; amountCentavos: number };
export type AllocationSummary = { categoryCentavos: number; debtCentavos: number; savingsCentavos: number; spentCentavos: number } | null;


function periodPredicate(range: ReportRange): [string, string] {
  return [range.startDate, range.endDate];
}

export async function getCashFlowSummary(userId: string, range: ReportRange): Promise<CashFlowSummary> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ income: number | null; outflow: number | null }>(
    `SELECT SUM(CASE WHEN transaction_type = 'income' THEN amount_centavos ELSE 0 END) AS income,
            SUM(CASE WHEN transaction_type = 'expense' OR destination_savings_goal_id IS NOT NULL THEN amount_centavos ELSE 0 END) AS outflow
       FROM transactions
       WHERE user_id = ? AND deleted = 0 AND status = 'posted'
         AND (transaction_type IN ('income', 'expense') OR destination_savings_goal_id IS NOT NULL)
         AND transaction_date >= ? AND transaction_date <= ?`,
    userId, ...periodPredicate(range),
  );
  const incomeCentavos = row?.income ?? 0;
  const outflowCentavos = row?.outflow ?? 0;
  return { incomeCentavos, outflowCentavos, netCashFlowCentavos: incomeCentavos - outflowCentavos };
}

export async function getCashFlowComparisonSummary(
  userId: string,
  range: ReportRange,
  averageByActiveMonth: boolean,
): Promise<CashFlowSummary> {
  if (!averageByActiveMonth) return getCashFlowSummary(userId, range);

  const db = await getDb();
  const row = await db.getFirstAsync<{ income: number | null; outflow: number | null; activeMonths: number }>(
    `SELECT SUM(CASE WHEN transaction_type = 'income' THEN amount_centavos ELSE 0 END) AS income,
            SUM(CASE WHEN transaction_type = 'expense' OR destination_savings_goal_id IS NOT NULL THEN amount_centavos ELSE 0 END) AS outflow,
            COUNT(DISTINCT substr(transaction_date, 1, 7)) AS activeMonths
       FROM transactions
       WHERE user_id = ? AND deleted = 0 AND status = 'posted'
         AND (transaction_type IN ('income', 'expense') OR destination_savings_goal_id IS NOT NULL)
         AND transaction_date >= ? AND transaction_date <= ?`,
    userId, ...periodPredicate(range),
  );
  const activeMonths = row?.activeMonths ?? 0;
  if (activeMonths === 0) return { incomeCentavos: 0, outflowCentavos: 0, netCashFlowCentavos: 0 };
  const incomeCentavos = Math.round((row?.income ?? 0) / activeMonths);
  const outflowCentavos = Math.round((row?.outflow ?? 0) / activeMonths);
  return { incomeCentavos, outflowCentavos, netCashFlowCentavos: incomeCentavos - outflowCentavos };
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
                WHEN t.transaction_type = 'transfer' AND t.source_account_id = t.destination_account_id THEN 0
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
        AND COALESCE(fa.opened_on, substr(fa.created_at, 1, 10)) <= ?`,
    endDate, userId, endDate,
  );
  return { accountCount: row?.count ?? 0, balanceCentavos: row?.total ?? 0 };
}

export async function getBudgetActualSummary(userId: string, range: ReportRange): Promise<BudgetActualSummary> {
  const db = await getDb();
  // Every plan period the range touches counts once, using its latest accepted plan, so a year compares
  // against all of its monthly plans rather than one.
  const plan = await db.getFirstAsync<{ total: number | null; plans: number }>(
    `SELECT SUM(p.available_funds_centavos) AS total, COUNT(*) AS plans FROM financial_plans p
      WHERE p.user_id = ? AND p.deleted = 0 AND p.status = 'accepted'
        AND p.period_start <= ? AND p.period_end >= ?
        AND NOT EXISTS (
          SELECT 1 FROM financial_plans newer
           WHERE newer.user_id = p.user_id AND newer.deleted = 0 AND newer.status = 'accepted'
             AND newer.period_start = p.period_start
             AND (newer.updated_at > p.updated_at OR (newer.updated_at = p.updated_at AND newer.id > p.id))
        )`,
    userId, range.endDate, range.startDate,
  );
  if (!plan?.plans) return null;
  const actual = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount_centavos) AS total FROM transactions
      WHERE user_id = ? AND deleted = 0 AND status = 'posted' AND transaction_type = 'expense'
        AND transaction_date >= ? AND transaction_date <= ?`,
    userId, ...periodPredicate(range),
  );
  const actualCentavos = actual?.total ?? 0;
  const plannedCentavos = plan.total ?? 0;
  return { plannedCentavos, actualCentavos, varianceCentavos: plannedCentavos - actualCentavos };
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

async function listOutflowCategories(userId: string, range: ReportRange, includeSavings: boolean): Promise<CategoryBreakdown[]> {
  const db = await getDb();
  return db.getAllAsync<CategoryBreakdown>(
    `WITH classified AS (
       SELECT t.amount_centavos,
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
              END AS kind,
              COALESCE(s.id, 'uncategorised') AS categoryId,
              COALESCE(s.label, 'Uncategorised') AS categoryLabel
         FROM transactions t
         LEFT JOIN subcategories s ON s.id = t.subcategory_id AND s.user_id = t.user_id AND s.deleted = 0
        WHERE t.user_id = ? AND t.deleted = 0 AND t.status = 'posted'
          AND (t.transaction_type = 'expense' OR (? = 1 AND t.destination_savings_goal_id IS NOT NULL))
          AND t.transaction_date >= ? AND t.transaction_date <= ?
     )
     SELECT CASE kind
              WHEN 'debt' THEN 'Debt repayments'
              WHEN 'savings' THEN 'Savings contributions'
              WHEN 'biller' THEN 'Billers & remittances'
              ELSE categoryLabel
            END AS label,
            SUM(amount_centavos) AS amountCentavos
       FROM classified
      GROUP BY kind, CASE WHEN kind = 'category' THEN categoryId END,
               CASE WHEN kind = 'category' THEN categoryLabel END
      ORDER BY amountCentavos DESC`,
    userId, includeSavings ? 1 : 0, ...periodPredicate(range),
  );
}

export async function listCategoryBreakdown(userId: string, range: ReportRange): Promise<CategoryBreakdown[]> {
  return (await listOutflowCategories(userId, range, false)).slice(0, 5);
}

export async function getCashOutflowDistribution(userId: string, range: ReportRange): Promise<CategoryBreakdown[]> {
  const categories = await listOutflowCategories(userId, range, true);
  const primaryCategories = categories.slice(0, 5);
  const otherCentavos = categories.slice(5).reduce((total, category) => total + category.amountCentavos, 0);
  return otherCentavos > 0 ? [...primaryCategories, { label: "Other", amountCentavos: otherCentavos }] : primaryCategories;
}

export async function getAllocationSummary(userId: string, range: ReportRange): Promise<AllocationSummary> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ debt: number; savings: number; category: number | null; spent: number }>(
    // The plan's leftover money is already directed to debt or savings, so it counts toward those totals.
    `SELECT p.debt_surplus_centavos + (SELECT COALESCE(SUM(amount_centavos), 0) FROM financial_plan_debt_reservations WHERE plan_id = p.id) AS debt,
            p.savings_surplus_centavos + (SELECT COALESCE(SUM(amount_centavos), 0) FROM financial_plan_savings_reservations WHERE plan_id = p.id) AS savings,
            (SELECT COALESCE(SUM(allocated_amount_centavos), 0) FROM financial_plan_allocations WHERE plan_id = p.id) AS category,
            -- Spent counts the same outflow as cash flow: expenses and savings contributions, across the whole cycle.
            (SELECT COALESCE(SUM(amount_centavos), 0) FROM transactions t
              WHERE t.user_id = p.user_id AND t.deleted = 0 AND t.status = 'posted'
                AND (t.transaction_type = 'expense' OR t.destination_savings_goal_id IS NOT NULL)
                AND t.transaction_date >= p.period_start AND t.transaction_date <= p.period_end) AS spent
       FROM financial_plans p
      WHERE p.user_id = ? AND p.deleted = 0 AND p.status = 'accepted'
        AND p.period_start <= ? AND p.period_end >= ?
      ORDER BY p.period_start DESC, p.updated_at DESC LIMIT 1`,
    userId, range.endDate, range.startDate,
  );
  if (!row) return null;
  const categoryCentavos = row.category ?? 0;
  return { categoryCentavos, debtCentavos: row.debt, savingsCentavos: row.savings, spentCentavos: row.spent };
}
