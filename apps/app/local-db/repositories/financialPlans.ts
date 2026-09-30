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

export type AcceptedFinancialPlan = {
  id: string;
  periodStart: string;
  periodEnd: string;
  inputSnapshot: Record<string, unknown>;
  recommendation: Record<string, unknown>;
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
  forecast_month: string;
  forecast_total_centavos: number;
  forecast_model_version: string;
  forecast_generated_at: string;
  forecast_quality: string;
  classification_status: string | null;
  classification_rule_set_version: string | null;
  classification_assessed_at: string | null;
  available_funds_centavos: number;
  required_funds_centavos: number | null;
  shortfall_centavos: number | null;
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

export function getNextFinancialPlanPeriod(referenceDate: string): { start: string; end: string } {
  assertDate(referenceDate, "referenceDate");
  return nextCalendarMonth(new Date(`${referenceDate}T00:00:00Z`));
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
    if (allocation.subcategoryWeightBps != null && (!Number.isSafeInteger(allocation.subcategoryWeightBps) || allocation.subcategoryWeightBps < 0 || allocation.subcategoryWeightBps > 10_000)) throw new LocalDbError("VALIDATION_ERROR", "subcategory weight must be between 0 and 10000 basis points");
  }
  const targets = input.allocations.map((allocation) => allocation.categoryId ? `category:${allocation.categoryId}` : `subcategory:${allocation.subcategoryId}`);
  if (new Set(targets).size !== targets.length) throw new LocalDbError("VALIDATION_ERROR", "Financial Plan allocations cannot target the same category or subcategory twice");
  const availableFunds = input.recommendation.availableFundsCentavos;
  if (!Number.isSafeInteger(availableFunds) || availableFunds < 0) throw new LocalDbError("VALIDATION_ERROR", "recommendation available funds must be a non-negative whole number");
  if (input.allocations.reduce((total, allocation) => total + allocation.allocatedAmountCentavos, 0) > availableFunds) {
    throw new LocalDbError("VALIDATION_ERROR", "Financial Plan allocations exceed available funds");
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
    subcategoryIds.length ? db.getAllAsync<{ id: string; category_id: string }>(`SELECT id, category_id FROM subcategories WHERE user_id = ? AND deleted = 0 AND is_active = 1 AND kind = 'expense' AND id IN (${subcategoryIds.map(() => "?").join(",")})`, userId, ...subcategoryIds) : [],
    debtIds.length ? db.getAllAsync<{ id: string }>(`SELECT id FROM debt_accounts WHERE user_id = ? AND deleted = 0 AND id IN (${debtIds.map(() => "?").join(",")})`, userId, ...debtIds) : [],
    statementIds.length ? db.getAllAsync<{ id: string }>(`SELECT id FROM credit_card_statements WHERE user_id = ? AND deleted = 0 AND id IN (${statementIds.map(() => "?").join(",")})`, userId, ...statementIds) : [],
    goalIds.length ? db.getAllAsync<{ id: string }>(`SELECT id FROM savings_goals WHERE user_id = ? AND deleted = 0 AND id IN (${goalIds.map(() => "?").join(",")})`, userId, ...goalIds) : [],
  ]);
  if (rows.some((value, index) => value.length !== [categoryIds, subcategoryIds, debtIds, statementIds, goalIds][index]!.length)) throw new LocalDbError("VALIDATION_ERROR", "Financial Plan reference is not accessible");
  const selectedCategoryIds = new Set(categoryIds);
  if ((rows[1] as Array<{ category_id: string }>).some((subcategory) => selectedCategoryIds.has(subcategory.category_id))) throw new LocalDbError("VALIDATION_ERROR", "Financial Plan cannot allocate both a category and one of its subcategories");
}

export async function createFinancialPlan(userId: string, deviceId: string, input: CreateFinancialPlanInput): Promise<{ id: string; operation: SyncOperation }> {
  validate(input);
  const db = await getDb(); const id = randomUUID(); const timestamp = now();
  const forecast = input.inputSnapshot.forecast as { month?: unknown; totalAmountCentavos?: unknown; modelVersion?: unknown; generatedAt?: unknown; quality?: unknown; categoryForecasts?: unknown };
  const classification = input.inputSnapshot.classification as { status?: unknown; rule_set_version?: unknown; assessed_at?: unknown };
  if (typeof forecast.month !== "string" || !Number.isSafeInteger(forecast.totalAmountCentavos) || typeof forecast.modelVersion !== "string" || typeof forecast.generatedAt !== "string" || typeof forecast.quality !== "string") throw new LocalDbError("VALIDATION_ERROR", "forecast snapshot is invalid");
  const recommendation = { ...input.recommendation, allocations: input.allocations, debtReservations: input.debtReservations, savingsReservations: input.savingsReservations };
  const payload = { period_start: input.periodStart, period_end: input.periodEnd, status: "accepted", input_snapshot: input.inputSnapshot, recommendation };
  let operation!: SyncOperation;
  await db.withTransactionAsync(async () => {
    await validateReferences(db, userId, input);
    await db.runAsync("INSERT INTO financial_plans (id, user_id, period_start, period_end, status, forecast_month, forecast_total_centavos, forecast_model_version, forecast_generated_at, forecast_quality, classification_status, classification_rule_set_version, classification_assessed_at, available_funds_centavos, required_funds_centavos, shortfall_centavos, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, 'accepted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)", id, userId, input.periodStart, input.periodEnd, forecast.month, forecast.totalAmountCentavos, forecast.modelVersion, forecast.generatedAt, forecast.quality, typeof classification.status === "string" ? classification.status : null, typeof classification.rule_set_version === "string" ? classification.rule_set_version : null, typeof classification.assessed_at === "string" ? classification.assessed_at : null, input.recommendation.availableFundsCentavos as number, input.recommendation.requiredFundsCentavos as number ?? null, input.recommendation.shortfallCentavos as number ?? null, timestamp, timestamp);
    if (!Array.isArray(forecast.categoryForecasts)) throw new LocalDbError("VALIDATION_ERROR", "forecast points are invalid");
    for (const point of forecast.categoryForecasts) {
      if (!point || typeof point !== "object" || typeof (point as { category?: unknown }).category !== "string" || !Number.isSafeInteger((point as { amountCentavos?: unknown }).amountCentavos)) throw new LocalDbError("VALIDATION_ERROR", "forecast point is invalid");
      await db.runAsync("INSERT INTO financial_plan_forecast_points (plan_id, category_key, amount_centavos) VALUES (?, ?, ?)", id, (point as { category: string }).category, (point as { amountCentavos: number }).amountCentavos);
    }
    for (const [index, allocation] of input.allocations.entries()) await db.runAsync("INSERT INTO financial_plan_allocations (id, plan_id, category_id, subcategory_id, allocation_rule, allocated_amount_centavos, floor_amount_centavos, ceiling_amount_centavos, forecast_amount_centavos, subcategory_weight_bps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", `${id}:allocation:${index}`, id, allocation.categoryId ?? null, allocation.subcategoryId ?? null, allocation.allocationRule, allocation.allocatedAmountCentavos, allocation.floorAmountCentavos, allocation.ceilingAmountCentavos ?? null, allocation.forecastAmountCentavos ?? null, allocation.subcategoryWeightBps ?? null);
    for (const [index, reservation] of input.debtReservations.entries()) await db.runAsync("INSERT INTO financial_plan_debt_reservations (id, plan_id, debt_account_id, credit_card_statement_id, amount_centavos, due_date) VALUES (?, ?, ?, ?, ?, ?)", `${id}:debt:${index}`, id, reservation.debtAccountId ?? null, reservation.creditCardStatementId ?? null, reservation.amountCentavos, reservation.dueDate ?? null);
    for (const [index, reservation] of input.savingsReservations.entries()) await db.runAsync("INSERT INTO financial_plan_savings_reservations (id, plan_id, savings_goal_id, amount_centavos, due_date) VALUES (?, ?, ?, ?, ?)", `${id}:savings:${index}`, id, reservation.savingsGoalId, reservation.amountCentavos, reservation.dueDate ?? null);
    operation = await enqueueOperation(db, { userId, deviceId, entity: "financial_plans", recordId: id, operationType: "create", baseVersion: null, changedFields: Object.keys(payload), payload, failureMessage: "This Financial Plan could not be saved." });
  });
  return { id, operation };
}

async function mapPlan(db: SQLite.SQLiteDatabase, row: FinancialPlanRow): Promise<AcceptedFinancialPlan> {
  const [points, allocations, debtReservations, savingsReservations] = await Promise.all([
    db.getAllAsync<Record<string, unknown>>("SELECT category_key, amount_centavos FROM financial_plan_forecast_points WHERE plan_id = ?", row.id),
    db.getAllAsync<Record<string, unknown>>("SELECT category_id, subcategory_id, allocation_rule, allocated_amount_centavos, floor_amount_centavos, ceiling_amount_centavos, forecast_amount_centavos, subcategory_weight_bps FROM financial_plan_allocations WHERE plan_id = ?", row.id),
    db.getAllAsync<Record<string, unknown>>("SELECT debt_account_id, credit_card_statement_id, amount_centavos, due_date FROM financial_plan_debt_reservations WHERE plan_id = ?", row.id),
    db.getAllAsync<Record<string, unknown>>("SELECT savings_goal_id, amount_centavos, due_date FROM financial_plan_savings_reservations WHERE plan_id = ?", row.id),
  ]);
  const mappedAllocations = allocations.map((allocation) => ({ categoryId: allocation.category_id, subcategoryId: allocation.subcategory_id, allocationRule: allocation.allocation_rule, allocatedAmountCentavos: allocation.allocated_amount_centavos, floorAmountCentavos: allocation.floor_amount_centavos, ceilingAmountCentavos: allocation.ceiling_amount_centavos, forecastAmountCentavos: allocation.forecast_amount_centavos, subcategoryWeightBps: allocation.subcategory_weight_bps }));
  const mappedDebtReservations = debtReservations.map((reservation) => ({ debtAccountId: reservation.debt_account_id, creditCardStatementId: reservation.credit_card_statement_id, amountCentavos: reservation.amount_centavos, dueDate: reservation.due_date }));
  const mappedSavingsReservations = savingsReservations.map((reservation) => ({ savingsGoalId: reservation.savings_goal_id, amountCentavos: reservation.amount_centavos, dueDate: reservation.due_date }));
  return { id: row.id, periodStart: row.period_start, periodEnd: row.period_end, inputSnapshot: { forecast: { month: row.forecast_month, totalAmountCentavos: row.forecast_total_centavos, modelVersion: row.forecast_model_version, generatedAt: row.forecast_generated_at, quality: row.forecast_quality, categoryForecasts: points.map((point) => ({ category: point.category_key, amountCentavos: point.amount_centavos })) }, restrictions: { allocations: mappedAllocations }, obligations: { reservations: [] }, debtRequirements: { reservations: mappedDebtReservations }, savingsRequirements: { reservations: mappedSavingsReservations }, classification: { status: row.classification_status, rule_set_version: row.classification_rule_set_version, assessed_at: row.classification_assessed_at } }, recommendation: { availableFundsCentavos: row.available_funds_centavos, requiredFundsCentavos: row.required_funds_centavos, shortfallCentavos: row.shortfall_centavos, allocations: mappedAllocations, debtReservations: mappedDebtReservations, savingsReservations: mappedSavingsReservations } };
}

export async function getFinancialPlan(userId: string, id: string): Promise<AcceptedFinancialPlan | null> {
  const row = await (await getDb()).getFirstAsync<FinancialPlanRow>("SELECT * FROM financial_plans WHERE user_id = ? AND id = ? AND status = 'accepted' AND deleted = 0", userId, id);
  return row ? mapPlan(await getDb(), row) : null;
}

export async function getLatestFinancialPlan(userId: string): Promise<AcceptedFinancialPlan | null> {
  const row = await (await getDb()).getFirstAsync<FinancialPlanRow>(
    "SELECT * FROM financial_plans WHERE user_id = ? AND status = 'accepted' AND deleted = 0 ORDER BY period_start DESC, updated_at DESC LIMIT 1",
    userId,
  );
  return row ? mapPlan(await getDb(), row) : null;
}

export async function getAcceptedFinancialPlanForPeriod(userId: string, periodStart: string, periodEnd: string): Promise<AcceptedFinancialPlan | null> {
  assertDate(periodStart, "periodStart");
  assertDate(periodEnd, "periodEnd");
  const db = await getDb();
  const row = await db.getFirstAsync<FinancialPlanRow>(
    "SELECT * FROM financial_plans WHERE user_id = ? AND period_start = ? AND period_end = ? AND status = 'accepted' AND deleted = 0 ORDER BY updated_at DESC LIMIT 1",
    userId,
    periodStart,
    periodEnd,
  );
  return row ? mapPlan(db, row) : null;
}
