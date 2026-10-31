import type { PlanSpendingReview, PlanSpendingReviewRow } from "../../features/financial-plan/pastPlanTypes";
import { getDb } from "./helpers/db";

type PlanRow = { id: string; period_start: string; period_end: string };
type AllocationRow = { id: string; category_id: string | null; subcategory_id: string | null; allocation_rule: PlanSpendingReviewRow["allocationRule"]; allocated_amount_centavos: number };
type SpendingGroupRow = { category_id: string | null; subcategory_id: string | null; amount_centavos: number };

// D2: posted, live expenses in the plan period, excluding debt payments, credit-card payments, savings transfers and
// scheduled (bill and remittance) payments. Those are reserved separately from category allocations, so they are not category spending.
// Grouped by (effective category, subcategory) so matching is done once per group, never once per allocation.
// transactions.category_id is not written by the app or pulled by sync, so the subcategory's parent is the
// authoritative category; t.category_id is only a fallback for rows without a resolvable subcategory.
const SPENDING_GROUPS_SQL = `
  SELECT COALESCE(s.category_id, t.category_id) AS category_id, t.subcategory_id, SUM(t.amount_centavos) AS amount_centavos
    FROM transactions t
    LEFT JOIN subcategories s ON s.id = t.subcategory_id AND (s.user_id = t.user_id OR s.is_system = 1)
   WHERE t.user_id = ? AND t.deleted = 0 AND t.status = 'posted' AND t.transaction_type = 'expense'
     AND t.transaction_date >= ? AND t.transaction_date <= ?
     AND t.source_savings_goal_id IS NULL AND t.destination_savings_goal_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.transaction_id = t.id AND dp.user_id = t.user_id AND dp.deleted = 0)
     AND NOT EXISTS (SELECT 1 FROM credit_card_payments cp WHERE cp.transaction_id = t.id AND cp.user_id = t.user_id AND cp.deleted = 0)
     AND NOT EXISTS (SELECT 1 FROM scheduled_payment_records sp WHERE sp.transaction_id = t.id AND sp.user_id = t.user_id AND sp.deleted = 0)
   GROUP BY COALESCE(s.category_id, t.category_id), t.subcategory_id`;

export async function getPlanSpendingReview(userId: string, planId: string): Promise<PlanSpendingReview | null> {
  const db = await getDb();
  const plan = await db.getFirstAsync<PlanRow>(
    "SELECT id, period_start, period_end FROM financial_plans WHERE user_id = ? AND id = ? AND status = 'accepted' AND deleted = 0",
    userId,
    planId,
  );
  if (!plan) return null;

  const [allocations, groups] = await Promise.all([
    db.getAllAsync<AllocationRow>(
      `SELECT a.id, a.category_id, a.subcategory_id, a.allocation_rule, a.allocated_amount_centavos
         FROM financial_plan_allocations a
         JOIN financial_plans p ON p.id = a.plan_id AND p.user_id = ?
        WHERE a.plan_id = ?
        ORDER BY a.rowid`,
      userId,
      planId,
    ),
    db.getAllAsync<SpendingGroupRow>(SPENDING_GROUPS_SQL, userId, plan.period_start, plan.period_end),
  ]);

  // D3: each spending group is assigned to exactly one bucket. A subcategory allocation wins over a
  // category allocation (plans never hold both, but this keeps the result single-counted if one ever does).
  const bySubcategory = new Map<string, string>();
  const byCategory = new Map<string, string>();
  for (const allocation of allocations) {
    if (allocation.subcategory_id) bySubcategory.set(allocation.subcategory_id, allocation.id);
    else if (allocation.category_id) byCategory.set(allocation.category_id, allocation.id);
  }
  const actualByAllocation = new Map<string, number>();
  let unplannedActualCentavos = 0;
  let actualTotalCentavos = 0;
  for (const group of groups) {
    const amount = group.amount_centavos ?? 0;
    actualTotalCentavos += amount;
    const allocationId = (group.subcategory_id && bySubcategory.get(group.subcategory_id))
      || (group.category_id && byCategory.get(group.category_id))
      || null;
    if (allocationId) actualByAllocation.set(allocationId, (actualByAllocation.get(allocationId) ?? 0) + amount);
    else unplannedActualCentavos += amount;
  }

  const rows: PlanSpendingReviewRow[] = allocations.map((allocation) => {
    const plannedCentavos = allocation.allocated_amount_centavos;
    const actualCentavos = actualByAllocation.get(allocation.id) ?? 0;
    return {
      allocationId: allocation.id,
      categoryId: allocation.category_id,
      subcategoryId: allocation.subcategory_id,
      allocationRule: allocation.allocation_rule,
      plannedCentavos,
      actualCentavos,
      varianceCentavos: plannedCentavos - actualCentavos,
      exceeded: actualCentavos > plannedCentavos,
    };
  });
  const plannedTotalCentavos = rows.reduce((sum, row) => sum + row.plannedCentavos, 0);

  return {
    planId: plan.id,
    periodStart: plan.period_start,
    periodEnd: plan.period_end,
    rows,
    unplannedActualCentavos,
    plannedTotalCentavos,
    actualTotalCentavos,
    exceeded: actualTotalCentavos > plannedTotalCentavos,
  };
}
