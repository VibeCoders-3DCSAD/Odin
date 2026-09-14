import * as SQLite from "expo-sqlite";
import { SAVINGS_GOAL_PRIORITIES, SAVINGS_GOAL_TYPES, type SavingsGoalPriority, type SavingsGoalType } from "../../features/savings-goals/constants";
import { calculateEmergencyFundBaseline, completedCalendarMonthRange } from "../../features/savings-goals/emergencyFundBaseline";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";

export type SavingsGoal = {
  id: string;
  name: string;
  goalType: SavingsGoalType;
  targetAmountCentavos: number;
  startingAmountCentavos: number;
  currentAmountCentavos: number;
  targetDate: string | null;
  priority: SavingsGoalPriority;
  emergencyFundBaselineCentavos: number | null;
  version: number;
};

export type CreateSavingsGoalInput = {
  name: string;
  goalType: SavingsGoalType;
  targetAmountCentavos: number;
  startingAmountCentavos: number;
  targetDate?: string | null;
  priority: SavingsGoalPriority;
  emergencyFundBaselineCentavos?: number | null;
};

export type UpdateSavingsGoalInput = Partial<CreateSavingsGoalInput>;

type SavingsGoalRow = {
  id: string; user_id: string; name: string; goal_type: string; target_amount_centavos: number;
  starting_amount_centavos: number; target_date: string | null; priority: string;
  emergency_fund_baseline_centavos: number | null; version: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function getDb() { dbPromise ??= initDatabase(); return dbPromise; }
function now() { return new Date().toISOString(); }

function mapGoal(row: SavingsGoalRow): SavingsGoal {
  return {
    id: row.id, name: row.name, goalType: row.goal_type as SavingsGoalType,
    targetAmountCentavos: row.target_amount_centavos, startingAmountCentavos: row.starting_amount_centavos,
    currentAmountCentavos: row.starting_amount_centavos, targetDate: row.target_date,
    priority: row.priority as SavingsGoalPriority,
    emergencyFundBaselineCentavos: row.emergency_fund_baseline_centavos, version: row.version,
  };
}

function assertAmount(value: number, field: string, positive = false) {
  if (!Number.isSafeInteger(value) || value < 0 || (positive && value === 0)) {
    throw new LocalDbError("VALIDATION_ERROR", `${field} must be a ${positive ? "positive" : "non-negative"} whole number`);
  }
}

function assertDate(value: string | null | undefined) {
  if (value !== null && value !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()))) {
    throw new LocalDbError("VALIDATION_ERROR", "target date must use YYYY-MM-DD format");
  }
}

function validate(input: CreateSavingsGoalInput): CreateSavingsGoalInput {
  const name = input.name.trim();
  if (!name) throw new LocalDbError("VALIDATION_ERROR", "goal name is required");
  if (!SAVINGS_GOAL_TYPES.includes(input.goalType)) throw new LocalDbError("VALIDATION_ERROR", "goal type is invalid");
  if (!SAVINGS_GOAL_PRIORITIES.includes(input.priority)) throw new LocalDbError("VALIDATION_ERROR", "priority is invalid");
  assertAmount(input.targetAmountCentavos, "target amount", true);
  assertAmount(input.startingAmountCentavos, "starting amount");
  if (input.emergencyFundBaselineCentavos != null) assertAmount(input.emergencyFundBaselineCentavos, "emergency fund baseline");
  assertDate(input.targetDate);
  return { ...input, name, targetDate: input.targetDate ?? null, emergencyFundBaselineCentavos: input.emergencyFundBaselineCentavos ?? null };
}

function payload(input: CreateSavingsGoalInput): Record<string, unknown> {
  return {
    name: input.name, goal_type: input.goalType, target_amount_centavos: input.targetAmountCentavos,
    starting_amount_centavos: input.startingAmountCentavos, target_date: input.targetDate ?? null,
    priority: input.priority, emergency_fund_baseline_centavos: input.emergencyFundBaselineCentavos ?? null,
  };
}

async function readOwned(db: SQLite.SQLiteDatabase, userId: string, id: string): Promise<SavingsGoalRow> {
  const row = await db.getFirstAsync<SavingsGoalRow>("SELECT * FROM savings_goals WHERE user_id = ? AND id = ? AND deleted = 0", userId, id);
  if (!row) throw new LocalDbError("NOT_FOUND", "Savings goal not found");
  return row;
}

async function readResult(db: SQLite.SQLiteDatabase, userId: string, id: string): Promise<SavingsGoal> {
  const row = await readOwned(db, userId, id);
  return mapGoal(row);
}

function inputFromRow(row: SavingsGoalRow): CreateSavingsGoalInput {
  return { name: row.name, goalType: row.goal_type as SavingsGoalType, targetAmountCentavos: row.target_amount_centavos, startingAmountCentavos: row.starting_amount_centavos, targetDate: row.target_date, priority: row.priority as SavingsGoalPriority, emergencyFundBaselineCentavos: row.emergency_fund_baseline_centavos };
}

export async function listSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SavingsGoalRow>("SELECT * FROM savings_goals WHERE user_id = ? AND deleted = 0 AND status = 'active' ORDER BY updated_at DESC, name COLLATE NOCASE ASC", userId);
  return rows.map(mapGoal);
}

export async function getSavingsGoal(userId: string, id: string): Promise<SavingsGoal | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SavingsGoalRow>("SELECT * FROM savings_goals WHERE user_id = ? AND id = ? AND deleted = 0 AND status = 'active'", userId, id);
  return row ? mapGoal(row) : null;
}

export async function getEmergencyFundBaseline(userId: string, referenceDate = new Date()): Promise<number> {
  const db = await getDb();
  const { from, to } = completedCalendarMonthRange(referenceDate);
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount_centavos), 0) AS total FROM transactions WHERE user_id = ? AND transaction_type = 'expense' AND status = 'posted' AND deleted = 0 AND transaction_date >= ? AND transaction_date < ?",
    userId, from, to,
  );
  return calculateEmergencyFundBaseline(row?.total ?? 0);
}

export async function createSavingsGoal(userId: string, deviceId: string, input: CreateSavingsGoalInput): Promise<{ goal: SavingsGoal; operation: SyncOperation }> {
  const valid = validate(input); const data = payload(valid); const db = await getDb(); const id = randomUUID(); const ts = now(); let result!: { goal: SavingsGoal; operation: SyncOperation };
  await db.withTransactionAsync(async () => {
    await db.runAsync("INSERT INTO savings_goals (id, user_id, name, goal_type, target_amount_centavos, starting_amount_centavos, target_date, priority, emergency_fund_baseline_centavos, status, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, 0, ?, ?)", id, userId, data.name as string, data.goal_type as string, data.target_amount_centavos as number, data.starting_amount_centavos as number, data.target_date as string | null, data.priority as string, data.emergency_fund_baseline_centavos as number | null, ts, ts);
    const operation = await enqueueOperation(db, { userId, deviceId, entity: "savings_goals", recordId: id, operationType: "create", baseVersion: null, changedFields: Object.keys(data), payload: data, failureMessage: `This savings goal \"${valid.name}\" could not be created.` });
    result = { goal: await readResult(db, userId, id), operation };
  });
  return result;
}

export async function updateSavingsGoal(userId: string, deviceId: string, id: string, input: UpdateSavingsGoalInput): Promise<{ goal: SavingsGoal; operation: SyncOperation | null }> {
  const db = await getDb(); let result!: { goal: SavingsGoal; operation: SyncOperation | null };
  await db.withTransactionAsync(async () => {
    const current = await readOwned(db, userId, id); const valid = validate({ ...inputFromRow(current), ...input }); const next = payload(valid); const before = payload(inputFromRow(current));
    const changed = Object.keys(next).filter((field) => next[field] !== before[field]);
    if (changed.length === 0) { result = { goal: mapGoal(current), operation: null }; return; }
    const ts = now(); const values = changed.map((field) => next[field]) as SQLite.SQLiteBindValue[];
    await db.runAsync(`UPDATE savings_goals SET ${changed.map((field) => `${field} = ?`).join(", ")}, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?`, ...values, ts, id, userId);
    const operation = await enqueueOperation(db, { userId, deviceId, entity: "savings_goals", recordId: id, operationType: "update", baseVersion: current.version, changedFields: changed, payload: Object.fromEntries(changed.map((field) => [field, next[field]])), failureMessage: `This savings goal \"${current.name}\" could not be updated.` });
    result = { goal: await readResult(db, userId, id), operation };
  });
  return result;
}

export async function deleteSavingsGoal(userId: string, deviceId: string, id: string): Promise<{ operation: SyncOperation }> {
  const db = await getDb(); let result!: { operation: SyncOperation };
  await db.withTransactionAsync(async () => {
    const current = await readOwned(db, userId, id); const ts = now();
    await db.runAsync("UPDATE savings_goals SET status = 'deleted', deleted = 1, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", ts, id, userId);
    result = { operation: await enqueueOperation(db, { userId, deviceId, entity: "savings_goals", recordId: id, operationType: "delete", baseVersion: current.version, changedFields: [], payload: {}, failureMessage: `This savings goal \"${current.name}\" could not be deleted.` }) };
  });
  return result;
}
