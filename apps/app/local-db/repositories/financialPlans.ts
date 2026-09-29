import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";

export type AllocationRule = "FIXED" | "MINIMUM" | "FLEXIBLE";

export type FinancialPlanAllocation = {
  categoryId?: string | null;
  subcategoryId?: string | null;
  allocationRule: AllocationRule;
  allocatedAmountCentavos: number;
  floorAmountCentavos: number;
  ceilingAmountCentavos?: number | null;
  forecastAmountCentavos?: number | null;
  subcategoryWeightBps?: number | null;
};

export type FinancialPlanDebtReservation = {
  debtAccountId?: string | null;
  creditCardStatementId?: string | null;
  amountCentavos: number;
  dueDate?: string | null;
};

export type FinancialPlanSavingsReservation = {
  savingsGoalId: string;
  amountCentavos: number;
  dueDate?: string | null;
};

export type CreateFinancialPlanInput = {
  periodStart: string;
  periodEnd: string;
  inputSnapshot: {
    forecast: Record<string, unknown>;
    restrictions: Record<string, unknown>;
    obligations: Record<string, unknown>;
    debtRequirements: Record<string, unknown>;
    savingsRequirements: Record<string, unknown>;
    classification: Record<string, unknown>;
  };
  recommendation: Record<string, unknown>;
  allocations: FinancialPlanAllocation[];
  debtReservations: FinancialPlanDebtReservation[];
  savingsReservations: FinancialPlanSavingsReservation[];
};

type FinancialPlanRow = {
  id: string;
  period_start: string;
  period_end: string;
  status: "accepted";
  input_snapshot_json: string;
  recommendation_json: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function getDb() { dbPromise ??= initDatabase(); return dbPromise; }
function now() { return new Date().toISOString(); }

function assertCentavos(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new LocalDbError("VALIDATION_ERROR", `${field} must be a non-negative whole number`);
}

function assertDate(value: string, field: string): void {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new LocalDbError("VALIDATION_ERROR", `${field} must be a valid YYYY-MM-DD date`);
}

function nextCalendarMonth(referenceDate = new Date()): { start: string; end: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).formatToParts(referenceDate);
  const year = Number(parts.find((part) => part.type === "year")!.value);
  const month = Number(parts.find((part) => part.type === "month")!.value);
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
}

function validate(input: CreateFinancialPlanInput): void {
  assertDate(input.periodStart, "periodStart"); assertDate(input.periodEnd, "periodEnd");
  const nextMonth = nextCalendarMonth();
  if (input.periodStart !== nextMonth.start || input.periodEnd !== nextMonth.end) throw new LocalDbError("VALIDATION_ERROR", "Financial Plans can only cover the next calendar month");
  for (const [name, snapshot] of Object.entries(input.inputSnapshot)) {
    if (Array.isArray(snapshot) || Object.keys(snapshot).length === 0) throw new LocalDbError("VALIDATION_ERROR", `${name} snapshot must contain plan input data`);
  }
  if (input.allocations.length > 200 || input.debtReservations.length > 100 || input.savingsReservations.length > 100) throw new LocalDbError("VALIDATION_ERROR", "Financial Plan has too many reservations or allocations");
  for (const allocation of input.allocations) {
    if (Boolean(allocation.categoryId) === Boolean(allocation.subcategoryId)) throw new LocalDbError("VALIDATION_ERROR", "each allocation must reference one category or subcategory");
    if (!["FIXED", "MINIMUM", "FLEXIBLE"].includes(allocation.allocationRule)) throw new LocalDbError("VALIDATION_ERROR", "allocation rule is invalid");
    assertCentavos(allocation.allocatedAmountCentavos, "allocated amount"); assertCentavos(allocation.floorAmountCentavos, "allocation floor");
    if (allocation.ceilingAmountCentavos != null && allocation.ceilingAmountCentavos < allocation.floorAmountCentavos) throw new LocalDbError("VALIDATION_ERROR", "allocation ceiling cannot be lower than its floor");
    if (allocation.allocatedAmountCentavos < allocation.floorAmountCentavos || (allocation.ceilingAmountCentavos != null && allocation.allocatedAmountCentavos > allocation.ceilingAmountCentavos)) throw new LocalDbError("VALIDATION_ERROR", "allocation does not meet its constraints");
  }
  for (const reservation of input.debtReservations) {
    if (Boolean(reservation.debtAccountId) === Boolean(reservation.creditCardStatementId)) throw new LocalDbError("VALIDATION_ERROR", "each debt reservation must reference one debt or statement");
    assertCentavos(reservation.amountCentavos, "debt reservation amount");
  }
  for (const reservation of input.savingsReservations) { if (!reservation.savingsGoalId) throw new LocalDbError("VALIDATION_ERROR", "savings reservation requires a goal"); assertCentavos(reservation.amountCentavos, "savings reservation amount"); }
}

async function validateReferences(db: SQLite.SQLiteDatabase, userId: string, input: CreateFinancialPlanInput): Promise<void> {
  const categoryIds = [...new Set(input.allocations.flatMap((allocation) => allocation.categoryId ? [allocation.categoryId] : []))];
  const subcategoryIds = [...new Set(input.allocations.flatMap((allocation) => allocation.subcategoryId ? [allocation.subcategoryId] : []))];
  const debtIds = [...new Set(input.debtReservations.flatMap((reservation) => reservation.debtAccountId ? [reservation.debtAccountId] : []))];
  const statementIds = [...new Set(input.debtReservations.flatMap((reservation) => reservation.creditCardStatementId ? [reservation.creditCardStatementId] : []))];
  const goalIds = [...new Set(input.savingsReservations.map((reservation) => reservation.savingsGoalId))];
  const rows = await Promise.all([
    categoryIds.length ? db.getAllAsync<{ id: string }>(`SELECT id FROM categories WHERE user_id = ? AND deleted = 0 AND is_active = 1 AND id IN (${categoryIds.map(() => "?").join(",")})`, userId, ...categoryIds) : [],
    subcategoryIds.length ? db.getAllAsync<{ id: string }>(`SELECT id FROM subcategories WHERE user_id = ? AND deleted = 0 AND is_active = 1 AND kind = 'expense' AND id IN (${subcategoryIds.map(() => "?").join(",")})`, userId, ...subcategoryIds) : [],
    debtIds.length ? db.getAllAsync<{ id: string }>(`SELECT id FROM debt_accounts WHERE user_id = ? AND deleted = 0 AND id IN (${debtIds.map(() => "?").join(",")})`, userId, ...debtIds) : [],
    statementIds.length ? db.getAllAsync<{ id: string }>(`SELECT id FROM credit_card_statements WHERE user_id = ? AND deleted = 0 AND id IN (${statementIds.map(() => "?").join(",")})`, userId, ...statementIds) : [],
    goalIds.length ? db.getAllAsync<{ id: string }>(`SELECT id FROM savings_goals WHERE user_id = ? AND deleted = 0 AND id IN (${goalIds.map(() => "?").join(",")})`, userId, ...goalIds) : [],
  ]);
  if (rows.some((value, index) => value.length !== [categoryIds, subcategoryIds, debtIds, statementIds, goalIds][index]!.length)) throw new LocalDbError("VALIDATION_ERROR", "Financial Plan reference is not accessible");
}

export async function createFinancialPlan(userId: string, deviceId: string, input: CreateFinancialPlanInput): Promise<{ id: string; operation: SyncOperation }> {
  validate(input);
  const db = await getDb(); const id = randomUUID(); const timestamp = now();
  const recommendation = { ...input.recommendation, allocations: input.allocations, debtReservations: input.debtReservations, savingsReservations: input.savingsReservations };
  const payload = { period_start: input.periodStart, period_end: input.periodEnd, status: "accepted", input_snapshot: input.inputSnapshot, recommendation };
  let operation!: SyncOperation;
  await db.withTransactionAsync(async () => {
    await validateReferences(db, userId, input);
    await db.runAsync("INSERT INTO financial_plans (id, user_id, period_start, period_end, status, input_snapshot_json, recommendation_json, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, 'accepted', ?, ?, 1, 0, ?, ?)", id, userId, input.periodStart, input.periodEnd, JSON.stringify(input.inputSnapshot), JSON.stringify(recommendation), timestamp, timestamp);
    operation = await enqueueOperation(db, { userId, deviceId, entity: "financial_plans", recordId: id, operationType: "create", baseVersion: null, changedFields: Object.keys(payload), payload, failureMessage: "This Financial Plan could not be saved." });
  });
  return { id, operation };
}

export async function getFinancialPlan(userId: string, id: string): Promise<{ id: string; periodStart: string; periodEnd: string; inputSnapshot: Record<string, unknown>; recommendation: Record<string, unknown> } | null> {
  const row = await (await getDb()).getFirstAsync<FinancialPlanRow>("SELECT * FROM financial_plans WHERE user_id = ? AND id = ? AND status = 'accepted' AND deleted = 0", userId, id);
  return row ? { id: row.id, periodStart: row.period_start, periodEnd: row.period_end, inputSnapshot: JSON.parse(row.input_snapshot_json) as Record<string, unknown>, recommendation: JSON.parse(row.recommendation_json) as Record<string, unknown> } : null;
}
