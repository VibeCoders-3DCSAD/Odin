import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { getPlanSpendingReview } from "./financialPlanSpendingReview";

export type SafeToSpendCategory = { allocationId: string; label: string; plannedCentavos: number; spentCentavos: number };

export type SafeToSpend = {
  periodEnd: string;
  daysLeft: number;
  plannedCentavos: number;
  spentCentavos: number;
  leftCentavos: number;
  dailyCentavos: number;
  categories: SafeToSpendCategory[];
};

const CATEGORY_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function getDb() { dbPromise ??= initDatabase(); return dbPromise; }

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

// What is left in this cycle's category budgets, using the same spending rules as the past-plan review,
// so unplanned spending also comes out of what is left.
export async function getSafeToSpend(userId: string, today: string): Promise<SafeToSpend | null> {
  const db = await getDb();
  const plan = await db.getFirstAsync<{ id: string; period_end: string }>(
    `SELECT id, period_end FROM financial_plans
      WHERE user_id = ? AND status = 'accepted' AND deleted = 0 AND period_start <= ? AND period_end >= ?
      ORDER BY period_start DESC, updated_at DESC LIMIT 1`,
    userId, today, today,
  );
  if (!plan) return null;
  const review = await getPlanSpendingReview(userId, plan.id);
  if (!review) return null;

  const categoryIds = [...new Set(review.rows.flatMap((row) => row.categoryId ? [row.categoryId] : []))];
  const subcategoryIds = [...new Set(review.rows.flatMap((row) => row.subcategoryId ? [row.subcategoryId] : []))];
  const [categories, subcategories] = await Promise.all([
    categoryIds.length ? db.getAllAsync<{ id: string; label: string }>(`SELECT id, label FROM categories WHERE (user_id = ? OR is_system = 1) AND id IN (${categoryIds.map(() => "?").join(",")})`, userId, ...categoryIds) : [],
    subcategoryIds.length ? db.getAllAsync<{ id: string; label: string }>(`SELECT id, label FROM subcategories WHERE (user_id = ? OR is_system = 1) AND id IN (${subcategoryIds.map(() => "?").join(",")})`, userId, ...subcategoryIds) : [],
  ]);
  const labels = new Map([...categories, ...subcategories].map((row) => [row.id, row.label]));

  const daysLeft = daysBetween(today, plan.period_end) + 1;
  const leftCentavos = review.plannedTotalCentavos - review.actualTotalCentavos;
  return {
    periodEnd: plan.period_end,
    daysLeft,
    plannedCentavos: review.plannedTotalCentavos,
    spentCentavos: review.actualTotalCentavos,
    leftCentavos,
    dailyCentavos: leftCentavos > 0 ? Math.floor(leftCentavos / daysLeft) : 0,
    // The budgets closest to their limit, so the card shows where to slow down first.
    categories: review.rows
      .filter((row) => row.plannedCentavos > 0)
      .sort((left, right) => right.actualCentavos / right.plannedCentavos - left.actualCentavos / left.plannedCentavos)
      .slice(0, CATEGORY_LIMIT)
      .map((row) => ({ allocationId: row.allocationId, label: labels.get(row.subcategoryId ?? row.categoryId ?? "") ?? "Category", plannedCentavos: row.plannedCentavos, spentCentavos: row.actualCentavos })),
  };
}
