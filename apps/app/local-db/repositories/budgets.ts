import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";

const PERIOD_KINDS = ["WEEKLY", "MONTHLY", "CUSTOM", "INCOME_CYCLE"] as const;
type PeriodKind = (typeof PERIOD_KINDS)[number];

type BudgetRow = {
  id: string;
  user_id: string;
  status: "draft" | "deleted";
  allocation_method: "MANUAL";
  period_kind: PeriodKind;
  period_start: string;
  period_end: string;
  budget_period_days: number;
  total_amount_minor: number;
  surplus_handling: "LEAVE_UNALLOCATED";
  deficit_handling: "BLOCK_ACTIVATION";
  allow_deficit_planning: number;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
};

type AllocationRow = {
  id: string;
  budget_id: string;
  category_id: string | null;
  subcategory_id: string | null;
  allocated_amount_minor: number;
  restriction_level: "OPEN";
};

export type BudgetAllocation = {
  id: string;
  categoryId: string | null;
  subcategoryId: string | null;
  amountMinor: number;
};

export type Budget = {
  id: string;
  status: "draft";
  allocationMethod: "MANUAL";
  periodKind: PeriodKind;
  periodStart: string;
  periodEnd: string;
  budgetPeriodDays: number;
  totalAmountMinor: number;
  allocatedAmountMinor: number;
  unallocatedAmountMinor: number;
  allocations: BudgetAllocation[];
};

export type BudgetTrackingAllocation = BudgetAllocation & {
  actualAmountMinor: number;
};

export type BudgetTracking = Omit<Budget, "allocations"> & {
  allocations: BudgetTrackingAllocation[];
};

export type CreateBudgetInput = {
  periodKind: PeriodKind;
  periodStart: string;
  periodEnd: string;
  totalAmountMinor: number;
  allocations: Array<{
    categoryId?: string | null;
    subcategoryId?: string | null;
    amountMinor: number;
  }>;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function mapBudget(row: BudgetRow, allocations: AllocationRow[]): Budget {
  const mapped = allocations.map((allocation) => ({
    id: allocation.id,
    categoryId: allocation.category_id,
    subcategoryId: allocation.subcategory_id,
    amountMinor: allocation.allocated_amount_minor,
  }));
  const allocatedAmountMinor = mapped.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
  return {
    id: row.id,
    status: "draft",
    allocationMethod: "MANUAL",
    periodKind: row.period_kind,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    budgetPeriodDays: row.budget_period_days,
    totalAmountMinor: row.total_amount_minor,
    allocatedAmountMinor,
    unallocatedAmountMinor: row.total_amount_minor - allocatedAmountMinor,
    allocations: mapped,
  };
}

function parseDate(value: string, field: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new LocalDbError("VALIDATION_ERROR", `${field} must be a valid YYYY-MM-DD date`);
  }
  return date;
}

function validateInput(input: CreateBudgetInput): number {
  if (!PERIOD_KINDS.includes(input.periodKind)) {
    throw new LocalDbError("VALIDATION_ERROR", `periodKind must be one of: ${PERIOD_KINDS.join(", ")}`);
  }
  const start = parseDate(input.periodStart, "periodStart");
  const end = parseDate(input.periodEnd, "periodEnd");
  const periodDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (periodDays <= 0) throw new LocalDbError("VALIDATION_ERROR", "periodEnd must be after periodStart");
  if (input.periodKind === "WEEKLY" && periodDays !== 7) {
    throw new LocalDbError("VALIDATION_ERROR", "WEEKLY budgets must span 7 days");
  }
  if (input.periodKind === "MONTHLY") {
    const expectedEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    if (input.periodStart.slice(0, 7) !== input.periodEnd.slice(0, 7) || end.getTime() !== expectedEnd.getTime()) {
      throw new LocalDbError("VALIDATION_ERROR", "MONTHLY budgets must end on the last day of the start month");
    }
  }
  if (input.periodKind === "CUSTOM" && periodDays > 366) {
    throw new LocalDbError("VALIDATION_ERROR", "CUSTOM budgets cannot exceed 366 days");
  }
  if (!Number.isInteger(input.totalAmountMinor) || input.totalAmountMinor <= 0) {
    throw new LocalDbError("VALIDATION_ERROR", "totalAmountMinor must be a positive integer");
  }
  let total = 0;
  for (const allocation of input.allocations) {
    if ((!allocation.categoryId && !allocation.subcategoryId) || (allocation.categoryId && allocation.subcategoryId)) {
      throw new LocalDbError("VALIDATION_ERROR", "each allocation must reference one category or subcategory");
    }
    if (!Number.isInteger(allocation.amountMinor) || allocation.amountMinor <= 0) {
      throw new LocalDbError("VALIDATION_ERROR", "allocation amounts must be positive integers");
    }
    total += allocation.amountMinor;
  }
  if (total > input.totalAmountMinor) {
    throw new LocalDbError("VALIDATION_ERROR", "allocations cannot exceed the budget total");
  }
  return periodDays;
}

async function readBudget(db: SQLite.SQLiteDatabase, userId: string, id: string): Promise<Budget | null> {
  const row = await db.getFirstAsync<BudgetRow>(
    "SELECT * FROM budgets WHERE user_id = ? AND id = ? AND status = 'draft' AND deleted = 0",
    userId,
    id,
  );
  if (!row) return null;
  const allocations = await db.getAllAsync<AllocationRow>(
    "SELECT * FROM budget_allocations WHERE user_id = ? AND budget_id = ? AND deleted = 0 ORDER BY rowid",
    userId,
    id,
  );
  return mapBudget(row, allocations);
}

export async function listBudgetDrafts(userId: string): Promise<Budget[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BudgetRow>(
    "SELECT * FROM budgets WHERE user_id = ? AND status = 'draft' AND deleted = 0 ORDER BY period_start DESC, created_at DESC",
    userId,
  );
  return Promise.all(rows.map(async (row) => mapBudget(row, await db.getAllAsync<AllocationRow>(
    "SELECT * FROM budget_allocations WHERE user_id = ? AND budget_id = ? AND deleted = 0 ORDER BY rowid",
    userId,
    row.id,
  ))));
}

export async function getBudgetDraft(userId: string, id: string): Promise<Budget | null> {
  return readBudget(await getDb(), userId, id);
}

export async function getBudgetDraftTracking(userId: string, id: string): Promise<BudgetTracking | null> {
  const db = await getDb();
  const budget = await readBudget(db, userId, id);
  if (!budget) return null;

  const rows = await db.getAllAsync<{ id: string; actual_amount_minor: number }>(
    `SELECT ba.id, COALESCE(SUM(t.amount_centavos), 0) AS actual_amount_minor
       FROM budget_allocations ba
       LEFT JOIN subcategories s ON s.id = ba.subcategory_id OR s.category_id = ba.category_id
       LEFT JOIN transactions t ON t.user_id = ? AND t.subcategory_id = s.id
         AND t.transaction_type = 'expense' AND t.status = 'posted' AND t.deleted = 0
         AND t.transaction_date >= ? AND t.transaction_date <= ?
      WHERE ba.user_id = ? AND ba.budget_id = ? AND ba.deleted = 0
      GROUP BY ba.id
      ORDER BY ba.rowid`,
    userId,
    budget.periodStart,
    budget.periodEnd,
    userId,
    id,
  );
  const actualByAllocation = new Map(rows.map((row) => [row.id, row.actual_amount_minor]));
  return {
    ...budget,
    allocations: budget.allocations.map((allocation) => ({
      ...allocation,
      actualAmountMinor: actualByAllocation.get(allocation.id) ?? 0,
    })),
  };
}

export async function createBudgetDraft(
  userId: string,
  deviceId: string,
  input: CreateBudgetInput,
): Promise<{ budget: Budget; operation: SyncOperation }> {
  const periodDays = validateInput(input);
  const db = await getDb();
  const budgetId = randomUUID();
  const timestamp = new Date().toISOString();
  const allocationIds = input.allocations.map(() => randomUUID());
  let result: { budget: Budget; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    for (const allocation of input.allocations) {
      const id = allocation.categoryId ?? allocation.subcategoryId;
      if (!id) throw new LocalDbError("VALIDATION_ERROR", "allocation reference is required");
      const table = allocation.categoryId ? "categories" : "subcategories";
      const accessible = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM ${table} WHERE (user_id = ? OR is_system = 1) AND id = ? AND deleted = 0 AND is_active = 1`,
        userId,
        id,
      );
      if (!accessible) throw new LocalDbError("VALIDATION_ERROR", `${table.slice(0, -1)} does not belong to the user`);
    }

    await db.runAsync(
      `INSERT INTO budgets
        (id, user_id, status, allocation_method, period_kind, period_start, period_end,
         budget_period_days, total_amount_minor, surplus_handling, deficit_handling,
         allow_deficit_planning, version, deleted, created_at, updated_at)
       VALUES (?, ?, 'draft', 'MANUAL', ?, ?, ?, ?, ?, 'LEAVE_UNALLOCATED', 'BLOCK_ACTIVATION', 0, 1, 0, ?, ?)`,
      budgetId, userId, input.periodKind, input.periodStart, input.periodEnd, periodDays,
      input.totalAmountMinor, timestamp, timestamp,
    );
    for (const [index, allocation] of input.allocations.entries()) {
      await db.runAsync(
        `INSERT INTO budget_allocations
          (id, user_id, budget_id, category_id, subcategory_id, allocated_amount_minor,
           restriction_level, version, deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'OPEN', 1, 0, ?, ?)`,
        allocationIds[index]!, userId, budgetId, allocation.categoryId ?? null,
        allocation.subcategoryId ?? null, allocation.amountMinor, timestamp, timestamp,
      );
    }

    const payload = { id: budgetId, user_id: userId, status: "draft", allocation_method: "MANUAL", ...input,
      budget_period_days: periodDays, surplus_handling: "LEAVE_UNALLOCATED", deficit_handling: "BLOCK_ACTIVATION",
      allow_deficit_planning: false, allocations: input.allocations.map((allocation, index) => ({ id: allocationIds[index], ...allocation })), };
    const operation = await enqueueOperation(db, {
      userId, deviceId, entity: "budgets", recordId: budgetId, operationType: "create", baseVersion: null,
      changedFields: [], payload, failureMessage: "This budget draft could not be created.",
    });
    result = { budget: (await readBudget(db, userId, budgetId))!, operation };
  });
  return result!;
}

export async function deleteBudgetDraft(
  userId: string,
  deviceId: string,
  id: string,
): Promise<{ budget: Budget; operation: SyncOperation }> {
  const db = await getDb();
  let result: { budget: Budget; operation: SyncOperation };
  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<BudgetRow>(
      "SELECT * FROM budgets WHERE user_id = ? AND id = ? AND status = 'draft' AND deleted = 0",
      userId, id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Budget draft not found");
    const existing = await readBudget(db, userId, id);
    if (!existing) throw new LocalDbError("NOT_FOUND", "Budget draft not found");
    await db.runAsync("UPDATE budgets SET status = 'deleted', deleted = 1, version = version + 1, updated_at = ? WHERE user_id = ? AND id = ?", new Date().toISOString(), userId, id);
    const operation = await enqueueOperation(db, {
      userId, deviceId, entity: "budgets", recordId: id, operationType: "delete", baseVersion: current.version,
      changedFields: [], payload: { id }, failureMessage: "This budget draft could not be deleted.",
    });
    result = { budget: existing, operation };
  });
  return result!;
}
