import * as SQLite from "expo-sqlite";
import { SAVINGS_GOAL_PRIORITIES, SAVINGS_GOAL_TYPES, type SavingsGoalPriority, type SavingsGoalType } from "../../features/savings-goals/constants";
import { calculateSavingsGoalProgress } from "../../features/savings-goals/savingsGoalModel";
import { EMERGENCY_FUND_TARGET_METHODS, type EmergencyFundTargetMethod, type SavingsGoalCategory, type SavingsGoalStatus } from "../../features/savings-goals/types";
import type { SavingsGoalProgress } from "../../features/savings-goals/types";
import { listSavingsGoalActivitiesByGoal } from "./savingsGoalActivities";
import { calculateEmergencyFundBaseline, completedCalendarMonthRange } from "../../features/savings-goals/emergencyFundBaseline";
import { validateContributionSchedule, type GoalContributionFrequency, type SavingsContributionSchedule } from "../../features/savings-goals/contributionSchedule";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";

export type SavingsGoal = SavingsGoalProgress & SavingsContributionSchedule & {
  id: string;
  name: string;
  goalType: SavingsGoalType;
  targetAmountCentavos: number;
  startingAmountCentavos: number;
  currentAmountCentavos: number;
  targetDate: string | null;
  priority: SavingsGoalPriority;
  emergencyFundBaselineCentavos: number | null;
  goalCategory: SavingsGoalCategory;
  autoSaveAmountCentavos: number;
  interestRateBps: number | null;
  notes: string | null;
  emergencyFundTargetMethod: EmergencyFundTargetMethod;
  essentialExpenseCoverageMonths: number | null;
  status: SavingsGoalStatus;
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
  goalCategory?: SavingsGoalCategory;
  autoSaveAmountCentavos?: number;
  plannedContributionAmountCentavos?: number | null;
  contributionFrequency?: GoalContributionFrequency | null;
  contributionIntervalCount?: number | null;
  contributionDayOfMonth?: number | null;
  contributionSecondDayOfMonth?: number | null;
  contributionDayOfWeek?: number | null;
  customIntervalDays?: number | null;
  nextContributionDate?: string | null;
  interestRateBps?: number | null;
  notes?: string | null;
  emergencyFundTargetMethod?: EmergencyFundTargetMethod;
  essentialExpenseCoverageMonths?: number | null;
};

export type UpdateSavingsGoalInput = Partial<CreateSavingsGoalInput>;

type SavingsGoalRow = {
  id: string; user_id: string; name: string; goal_type: string; target_amount_centavos: number;
  starting_amount_centavos: number; target_date: string | null; priority: string;
  emergency_fund_baseline_centavos: number | null; goal_category: string | null; auto_save_amount_centavos: number;
  planned_contribution_amount_centavos: number | null; contribution_frequency: GoalContributionFrequency | null;
  contribution_interval_count: number | null; contribution_day_of_month: number | null;
  contribution_second_day_of_month: number | null; contribution_day_of_week: number | null;
  custom_interval_days: number | null; next_contribution_date: string | null;
  interest_rate_bps: number | null; notes: string | null; emergency_fund_target_method: string; essential_expense_coverage_months: number | null;
  status: SavingsGoalStatus; version: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function getDb() { dbPromise ??= initDatabase(); return dbPromise; }
function now() { return new Date().toISOString(); }

function mapGoal(row: SavingsGoalRow): SavingsGoal {
  return {
    id: row.id, name: row.name, goalType: row.goal_type as SavingsGoalType,
    targetAmountCentavos: row.target_amount_centavos, startingAmountCentavos: row.starting_amount_centavos,
    currentAmountCentavos: row.starting_amount_centavos, remainingAmountCentavos: Math.max(0, row.target_amount_centavos - row.starting_amount_centavos), progressPercent: Math.min(100, Math.round((row.starting_amount_centavos / row.target_amount_centavos) * 100)), isAchieved: row.starting_amount_centavos >= row.target_amount_centavos, contributionShortfallCentavos: 0, targetDate: row.target_date,
    priority: row.priority as SavingsGoalPriority,
    emergencyFundBaselineCentavos: row.emergency_fund_baseline_centavos, goalCategory: (row.goal_category ?? row.goal_type) as SavingsGoalCategory,
    autoSaveAmountCentavos: row.auto_save_amount_centavos, interestRateBps: row.interest_rate_bps, notes: row.notes,
    plannedContributionAmountCentavos: row.planned_contribution_amount_centavos ?? row.auto_save_amount_centavos,
    contributionFrequency: row.contribution_frequency, contributionIntervalCount: row.contribution_interval_count,
    contributionDayOfMonth: row.contribution_day_of_month, contributionSecondDayOfMonth: row.contribution_second_day_of_month,
    contributionDayOfWeek: row.contribution_day_of_week, customIntervalDays: row.custom_interval_days,
    nextContributionDate: row.next_contribution_date,
    emergencyFundTargetMethod: row.emergency_fund_target_method as EmergencyFundTargetMethod,
    essentialExpenseCoverageMonths: row.essential_expense_coverage_months, status: row.status, version: row.version,
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
  assertAmount(input.autoSaveAmountCentavos ?? 0, "auto-save amount");
  if (input.interestRateBps != null) assertAmount(input.interestRateBps, "interest rate");
  if (input.notes != null && input.notes.length > 1_000) throw new LocalDbError("VALIDATION_ERROR", "notes must be 1000 characters or fewer");
  const category = input.goalCategory ?? input.goalType;
  if (!SAVINGS_GOAL_TYPES.includes(category)) throw new LocalDbError("VALIDATION_ERROR", "goal category is invalid");
  const method = input.emergencyFundTargetMethod ?? "fixed_amount";
  if (!EMERGENCY_FUND_TARGET_METHODS.includes(method)) throw new LocalDbError("VALIDATION_ERROR", "emergency fund target method is invalid");
  const coverage = input.essentialExpenseCoverageMonths ?? null;
  if (method === "essential_expense_coverage" && (category !== "emergency_fund" || !Number.isInteger(coverage) || coverage! < 3 || coverage! > 6)) throw new LocalDbError("VALIDATION_ERROR", "Emergency Fund coverage must be between 3 and 6 months");
  assertDate(input.targetDate);
  const scheduleError = validateContributionSchedule({
    plannedContributionAmountCentavos: input.plannedContributionAmountCentavos ?? input.autoSaveAmountCentavos ?? 0,
    contributionFrequency: input.contributionFrequency ?? null,
    contributionIntervalCount: input.contributionIntervalCount ?? null,
    contributionDayOfMonth: input.contributionDayOfMonth ?? null,
    contributionSecondDayOfMonth: input.contributionSecondDayOfMonth ?? null,
    contributionDayOfWeek: input.contributionDayOfWeek ?? null,
    customIntervalDays: input.customIntervalDays ?? null,
    nextContributionDate: input.nextContributionDate ?? null,
  });
  if (scheduleError) throw new LocalDbError("VALIDATION_ERROR", scheduleError);
  if (!input.targetDate || !input.nextContributionDate || input.nextContributionDate > input.targetDate) throw new LocalDbError("VALIDATION_ERROR", "next contribution date must be on or before target date");
  return { ...input, name, goalType: category, goalCategory: category, targetDate: input.targetDate ?? null, emergencyFundBaselineCentavos: input.emergencyFundBaselineCentavos ?? null, autoSaveAmountCentavos: input.autoSaveAmountCentavos ?? 0, plannedContributionAmountCentavos: input.plannedContributionAmountCentavos ?? input.autoSaveAmountCentavos ?? 0, contributionIntervalCount: input.contributionIntervalCount ?? 1, interestRateBps: input.interestRateBps ?? null, notes: input.notes?.trim() || null, emergencyFundTargetMethod: method, essentialExpenseCoverageMonths: coverage };
}

function payload(input: CreateSavingsGoalInput): Record<string, unknown> {
  return {
    name: input.name, goal_type: input.goalType, target_amount_centavos: input.targetAmountCentavos,
    starting_amount_centavos: input.startingAmountCentavos, target_date: input.targetDate ?? null,
    priority: input.priority, emergency_fund_baseline_centavos: input.emergencyFundBaselineCentavos ?? null,
    goal_category: input.goalCategory ?? input.goalType, auto_save_amount_centavos: input.autoSaveAmountCentavos ?? 0,
    planned_contribution_amount_centavos: input.plannedContributionAmountCentavos ?? input.autoSaveAmountCentavos ?? 0,
    contribution_frequency: input.contributionFrequency ?? null, contribution_interval_count: input.contributionIntervalCount ?? 1,
    contribution_day_of_month: input.contributionDayOfMonth ?? null, contribution_second_day_of_month: input.contributionSecondDayOfMonth ?? null,
    contribution_day_of_week: input.contributionDayOfWeek ?? null, custom_interval_days: input.customIntervalDays ?? null,
    next_contribution_date: input.nextContributionDate ?? null,
    interest_rate_bps: input.interestRateBps ?? null, notes: input.notes ?? null,
    emergency_fund_target_method: input.emergencyFundTargetMethod ?? "fixed_amount", essential_expense_coverage_months: input.essentialExpenseCoverageMonths ?? null,
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
  return { name: row.name, goalType: row.goal_type as SavingsGoalType, goalCategory: (row.goal_category ?? row.goal_type) as SavingsGoalCategory, targetAmountCentavos: row.target_amount_centavos, startingAmountCentavos: row.starting_amount_centavos, targetDate: row.target_date, priority: row.priority as SavingsGoalPriority, emergencyFundBaselineCentavos: row.emergency_fund_baseline_centavos, autoSaveAmountCentavos: row.auto_save_amount_centavos, plannedContributionAmountCentavos: row.planned_contribution_amount_centavos, contributionFrequency: row.contribution_frequency, contributionIntervalCount: row.contribution_interval_count, contributionDayOfMonth: row.contribution_day_of_month, contributionSecondDayOfMonth: row.contribution_second_day_of_month, contributionDayOfWeek: row.contribution_day_of_week, customIntervalDays: row.custom_interval_days, nextContributionDate: row.next_contribution_date, interestRateBps: row.interest_rate_bps, notes: row.notes, emergencyFundTargetMethod: row.emergency_fund_target_method as EmergencyFundTargetMethod, essentialExpenseCoverageMonths: row.essential_expense_coverage_months };
}

export async function listSavingsGoals(userId: string, status: Extract<SavingsGoalStatus, "active" | "archived"> = "active"): Promise<SavingsGoal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SavingsGoalRow>("SELECT * FROM savings_goals WHERE user_id = ? AND deleted = 0 AND status = ? ORDER BY updated_at DESC, name COLLATE NOCASE ASC", userId, status);
  const activities = await listSavingsGoalActivitiesByGoal(userId, rows.map((row) => row.id));
  return rows.map((row) => ({ ...mapGoal(row), ...calculateSavingsGoalProgress(row.starting_amount_centavos, row.target_amount_centavos, activities.get(row.id) ?? []) }));
}

export async function getSavingsGoal(userId: string, id: string): Promise<SavingsGoal | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SavingsGoalRow>("SELECT * FROM savings_goals WHERE user_id = ? AND id = ? AND deleted = 0 AND status IN ('active', 'archived')", userId, id);
  if (!row) return null;
  const activities = await listSavingsGoalActivitiesByGoal(userId, [id]);
  return { ...mapGoal(row), ...calculateSavingsGoalProgress(row.starting_amount_centavos, row.target_amount_centavos, activities.get(id) ?? []) };
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
    await db.runAsync("INSERT INTO savings_goals (id, user_id, name, goal_type, goal_category, target_amount_centavos, starting_amount_centavos, target_date, priority, emergency_fund_baseline_centavos, auto_save_amount_centavos, planned_contribution_amount_centavos, contribution_frequency, contribution_interval_count, contribution_day_of_month, contribution_second_day_of_month, contribution_day_of_week, custom_interval_days, next_contribution_date, interest_rate_bps, notes, emergency_fund_target_method, essential_expense_coverage_months, status, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, 0, ?, ?)", id, userId, data.name as string, data.goal_type as string, data.goal_category as string, data.target_amount_centavos as number, data.starting_amount_centavos as number, data.target_date as string | null, data.priority as string, data.emergency_fund_baseline_centavos as number | null, data.auto_save_amount_centavos as number, data.planned_contribution_amount_centavos as number, data.contribution_frequency as string, data.contribution_interval_count as number, data.contribution_day_of_month as number | null, data.contribution_second_day_of_month as number | null, data.contribution_day_of_week as number | null, data.custom_interval_days as number | null, data.next_contribution_date as string, data.interest_rate_bps as number | null, data.notes as string | null, data.emergency_fund_target_method as string, data.essential_expense_coverage_months as number | null, ts, ts);
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

export async function archiveSavingsGoal(userId: string, deviceId: string, id: string): Promise<{ goal: SavingsGoal; operation: SyncOperation }> {
  return setSavingsGoalStatus(userId, deviceId, id, "archived");
}

export async function restoreSavingsGoal(userId: string, deviceId: string, id: string): Promise<{ goal: SavingsGoal; operation: SyncOperation }> {
  return setSavingsGoalStatus(userId, deviceId, id, "active");
}

async function setSavingsGoalStatus(userId: string, deviceId: string, id: string, status: "active" | "archived"): Promise<{ goal: SavingsGoal; operation: SyncOperation }> {
  const db = await getDb(); let result!: { goal: SavingsGoal; operation: SyncOperation };
  await db.withTransactionAsync(async () => {
    const current = await readOwned(db, userId, id);
    if (current.status === status) {
      throw new LocalDbError("VALIDATION_ERROR", `Savings goal is already ${status}.`);
    }
    const ts = now(); const archivedAt = status === "archived" ? ts : null;
    await db.runAsync("UPDATE savings_goals SET status = ?, archived_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", status, archivedAt, ts, id, userId);
    const operation = await enqueueOperation(db, { userId, deviceId, entity: "savings_goals", recordId: id, operationType: "update", baseVersion: current.version, changedFields: ["status", "archived_at"], payload: { status, archived_at: archivedAt }, failureMessage: `This savings goal \"${current.name}\" could not be ${status === "archived" ? "archived" : "restored"}.` });
    result = { goal: await readResult(db, userId, id), operation };
  });
  return result;
}
