import type { PullDb } from "./pullConvergence";

export async function clearFinancialPlanChildren(db: PullDb, planId: string): Promise<void> {
  await db.runAsync("DELETE FROM financial_plan_forecast_points WHERE plan_id = ?", planId);
  await db.runAsync("DELETE FROM financial_plan_allocations WHERE plan_id = ?", planId);
  await db.runAsync("DELETE FROM financial_plan_debt_reservations WHERE plan_id = ?", planId);
  await db.runAsync("DELETE FROM financial_plan_savings_reservations WHERE plan_id = ?", planId);
}

// Reviews use normalized child tables. Restore them in batches from the immutable
// documents too, so a plan pulled onto another device has the same review baseline.
export async function restoreFinancialPlanChildren(db: PullDb, row: Record<string, unknown>): Promise<void> {
  if (typeof row.input_snapshot_json !== "string" || typeof row.recommendation_json !== "string") return;
  const planId = row.id as string;
  await db.runAsync(`INSERT OR REPLACE INTO financial_plan_forecast_points (plan_id, category_key, amount_centavos)
    SELECT ?, json_extract(value, '$.category'), json_extract(value, '$.amountCentavos')
    FROM json_each(?, '$.forecast.categoryForecasts')`, planId, row.input_snapshot_json);
  await db.runAsync(`INSERT OR REPLACE INTO financial_plan_allocations
    (id, plan_id, category_id, subcategory_id, allocation_rule, allocated_amount_centavos, floor_amount_centavos, ceiling_amount_centavos, forecast_amount_centavos, subcategory_weight_bps)
    SELECT ? || ':allocation:' || key, ?, json_extract(value, '$.categoryId'), json_extract(value, '$.subcategoryId'),
      json_extract(value, '$.allocationRule'), json_extract(value, '$.allocatedAmountCentavos'), json_extract(value, '$.floorAmountCentavos'),
      json_extract(value, '$.ceilingAmountCentavos'), json_extract(value, '$.forecastAmountCentavos'), json_extract(value, '$.subcategoryWeightBps')
    FROM json_each(?, '$.allocations')`, planId, planId, row.recommendation_json);
  await db.runAsync(`INSERT OR REPLACE INTO financial_plan_debt_reservations
    (id, plan_id, debt_account_id, credit_card_statement_id, amount_centavos, due_date)
    SELECT ? || ':debt:' || key, ?, json_extract(value, '$.debtAccountId'), json_extract(value, '$.creditCardStatementId'),
      json_extract(value, '$.amountCentavos'), json_extract(value, '$.dueDate')
    FROM json_each(?, '$.debtReservations')`, planId, planId, row.recommendation_json);
  await db.runAsync(`INSERT OR REPLACE INTO financial_plan_savings_reservations (id, plan_id, savings_goal_id, amount_centavos, due_date)
    SELECT ? || ':savings:' || key, ?, json_extract(value, '$.savingsGoalId'), json_extract(value, '$.amountCentavos'), json_extract(value, '$.dueDate')
    FROM json_each(?, '$.savingsReservations')`, planId, planId, row.recommendation_json);
}
