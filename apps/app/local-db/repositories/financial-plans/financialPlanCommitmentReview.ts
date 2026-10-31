import type {
  PlanCommitmentReview,
  PlanCommitmentStatus,
  PlanDebtCommitmentRow,
  PlanSavingsCommitmentRow,
} from "../../../features/financial-plan/past-plans/pastPlanTypes";
import type { PlanCommitmentPayments } from "../../../features/financial-plan/helpers/commitmentPayments";
import { getDb } from "../helpers/db";

type PlanPeriodRow = { id: string; period_start: string; period_end: string };
type ReservationRow = { target_id: string; reserved_centavos: number; due_date: string | null };
type ActualRow = { target_id: string; actual_centavos: number };
type DebtReservationRow = ReservationRow & { target_kind: DebtTargetKind };
type DebtActualRow = ActualRow & { target_kind: DebtTargetKind };
type DebtTargetKind = "debt" | "statement";

type CommitmentCore = {
  id: string;
  reservedCentavos: number;
  actualCentavos: number;
  additionalCentavos: number;
  status: PlanCommitmentStatus;
  dueDate: string | null;
};

// Reservation tables carry no user_id, so they are scoped through the owning plan.
const SAVINGS_RESERVATIONS_SQL = `
  SELECT r.savings_goal_id AS target_id, SUM(r.amount_centavos) AS reserved_centavos, MIN(r.due_date) AS due_date
  FROM financial_plan_savings_reservations r
  JOIN financial_plans p ON p.id = r.plan_id AND p.user_id = ?
  WHERE r.plan_id = ?
  GROUP BY r.savings_goal_id`;

const SAVINGS_ACTUALS_SQL = `
  SELECT savings_goal_id AS target_id, SUM(amount_centavos) AS actual_centavos
  FROM savings_goal_activities
  WHERE user_id = ? AND deleted = 0 AND activity_kind = 'contribution'
    AND activity_date >= ? AND activity_date <= ?
  GROUP BY savings_goal_id`;

const DEBT_RESERVATIONS_SQL = `
  SELECT CASE WHEN r.debt_account_id IS NOT NULL THEN 'debt' ELSE 'statement' END AS target_kind,
    COALESCE(r.debt_account_id, r.credit_card_statement_id) AS target_id,
    SUM(r.amount_centavos) AS reserved_centavos, MIN(r.due_date) AS due_date
  FROM financial_plan_debt_reservations r
  JOIN financial_plans p ON p.id = r.plan_id AND p.user_id = ?
  WHERE r.plan_id = ?
  GROUP BY target_kind, target_id`;

// Card payments without a statement cannot be attributed to a reservation and are skipped.
const DEBT_ACTUALS_SQL = `
  SELECT 'debt' AS target_kind, debt_account_id AS target_id, SUM(amount_centavos) AS actual_centavos
  FROM debt_payments
  WHERE user_id = ? AND deleted = 0 AND payment_date >= ? AND payment_date <= ?
  GROUP BY debt_account_id
  UNION ALL
  SELECT 'statement' AS target_kind, statement_id AS target_id, SUM(amount_centavos) AS actual_centavos
  FROM credit_card_payments
  WHERE user_id = ? AND deleted = 0 AND statement_id IS NOT NULL AND payment_date >= ? AND payment_date <= ?
  GROUP BY statement_id`;

function commitmentStatus(reserved: number, actual: number): PlanCommitmentStatus {
  if (reserved <= 0) return actual > 0 ? "unplanned" : "not_recorded";
  if (actual >= reserved) return "met";
  return actual > 0 ? "partial" : "not_recorded";
}

type KeyedCommitment = CommitmentCore & { key: string; reserved: boolean };

function compareCommitments(a: KeyedCommitment, b: KeyedCommitment): number {
  if (a.reserved !== b.reserved) return a.reserved ? -1 : 1;
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Joins reservations to actuals by key; actuals without a reservation become unplanned rows. */
function buildCommitments(reservations: (ReservationRow & { key: string })[], actuals: (ActualRow & { key: string })[]): KeyedCommitment[] {
  const actualByKey = new Map(actuals.map((row) => [row.key, Number(row.actual_centavos)]));
  const rows: KeyedCommitment[] = reservations.map((row) => {
    const reservedCentavos = Number(row.reserved_centavos);
    const actualCentavos = actualByKey.get(row.key) ?? 0;
    actualByKey.delete(row.key);
    return {
      key: row.key, reserved: true, id: row.target_id, reservedCentavos, actualCentavos, dueDate: row.due_date,
      additionalCentavos: Math.max(actualCentavos - reservedCentavos, 0),
      status: commitmentStatus(reservedCentavos, actualCentavos),
    };
  });
  for (const row of actuals) {
    const actualCentavos = actualByKey.get(row.key);
    if (actualCentavos === undefined || actualCentavos <= 0) continue;
    rows.push({ key: row.key, reserved: false, id: row.target_id, reservedCentavos: 0, actualCentavos, additionalCentavos: actualCentavos, status: "unplanned", dueDate: null });
  }
  return rows.sort(compareCommitments);
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

export async function getPlanCommitmentReview(userId: string, planId: string): Promise<PlanCommitmentReview | null> {
  const db = await getDb();
  const plan = await db.getFirstAsync<PlanPeriodRow>(
    "SELECT id, period_start, period_end FROM financial_plans WHERE id = ? AND user_id = ? AND status = 'accepted' AND deleted = 0",
    planId, userId,
  );
  if (!plan) return null;
  const { period_start: start, period_end: end } = plan;

  const [savingsReservations, savingsActuals, debtReservations, debtActuals] = await Promise.all([
    db.getAllAsync<ReservationRow>(SAVINGS_RESERVATIONS_SQL, userId, plan.id),
    db.getAllAsync<ActualRow>(SAVINGS_ACTUALS_SQL, userId, start, end),
    db.getAllAsync<DebtReservationRow>(DEBT_RESERVATIONS_SQL, userId, plan.id),
    db.getAllAsync<DebtActualRow>(DEBT_ACTUALS_SQL, userId, start, end, userId, start, end),
  ]);

  const savings: PlanSavingsCommitmentRow[] = buildCommitments(
    savingsReservations.map((row) => ({ ...row, key: row.target_id })),
    savingsActuals.map((row) => ({ ...row, key: row.target_id })),
  ).map(({ id, key: _key, reserved: _reserved, ...row }) => ({ savingsGoalId: id, ...row }));

  const debtKey = (row: { target_kind: DebtTargetKind; target_id: string }) => `${row.target_kind}:${row.target_id}`;
  const debts: PlanDebtCommitmentRow[] = buildCommitments(
    debtReservations.map((row) => ({ ...row, key: debtKey(row) })),
    debtActuals.map((row) => ({ ...row, key: debtKey(row) })),
  ).map(({ id, key, reserved: _reserved, ...row }) => {
    const isDebt = key.startsWith("debt:");
    return { debtAccountId: isDebt ? id : null, creditCardStatementId: isDebt ? null : id, ...row };
  });

  return {
    planId: plan.id,
    savings,
    debts,
    totals: {
      savingsReservedCentavos: sum(savings, (row) => row.reservedCentavos),
      savingsActualCentavos: sum(savings, (row) => row.actualCentavos),
      savingsAdditionalCentavos: sum(savings, (row) => row.additionalCentavos),
      debtReservedCentavos: sum(debts, (row) => row.reservedCentavos),
      debtActualCentavos: sum(debts, (row) => row.actualCentavos),
      debtAdditionalCentavos: sum(debts, (row) => row.additionalCentavos),
    },
  };
}

// Card payments count against their statement whenever they were made; billers count against the occurrence they were recorded for.
// A biller occurrence is settled when any of its payments was marked as paid in full.
const PERIOD_PAYMENTS_SQL = `
  SELECT 'savings:' || savings_goal_id AS payment_key, SUM(amount_centavos) AS paid_centavos, 0 AS settled
  FROM savings_goal_activities
  WHERE user_id = ? AND deleted = 0 AND activity_kind = 'contribution' AND activity_date >= ? AND activity_date <= ?
  GROUP BY savings_goal_id
  UNION ALL
  SELECT 'debt:' || debt_account_id, SUM(amount_centavos), 0
  FROM debt_payments
  WHERE user_id = ? AND deleted = 0 AND payment_date >= ? AND payment_date <= ?
  GROUP BY debt_account_id
  UNION ALL
  SELECT 'statement:' || statement_id, SUM(amount_centavos), 0
  FROM credit_card_payments
  WHERE user_id = ? AND deleted = 0 AND statement_id IS NOT NULL
  GROUP BY statement_id
  UNION ALL
  SELECT 'scheduled:' || scheduled_payment_id || ':' || occurrence_date, SUM(amount_centavos), MAX(settles_occurrence)
  FROM scheduled_payment_records
  WHERE user_id = ? AND deleted = 0 AND occurrence_date >= ? AND occurrence_date <= ?
  GROUP BY scheduled_payment_id, occurrence_date`;

/** Paid amounts and settled biller occurrences for an accepted plan's period, keyed like plan commitments (biller keys include the occurrence date). */
export async function getPlanCommitmentPayments(userId: string, period: { start: string; end: string }): Promise<PlanCommitmentPayments> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payment_key: string; paid_centavos: number; settled: number }>(
    PERIOD_PAYMENTS_SQL,
    userId, period.start, period.end, userId, period.start, period.end, userId, userId, period.start, period.end,
  );
  return {
    paidCentavos: Object.fromEntries(rows.map((row) => [row.payment_key, Number(row.paid_centavos)])),
    settledKeys: rows.filter((row) => row.settled === 1).map((row) => row.payment_key),
  };
}
