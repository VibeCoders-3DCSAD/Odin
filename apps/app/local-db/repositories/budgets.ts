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
  debt_budget_amount_minor: number;
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
  debtBudgetMinor: number;
  allocatedAmountMinor: number;
  unallocatedAmountMinor: number;
  allocations: BudgetAllocation[];
};

export type BudgetTrackingAllocation = BudgetAllocation & {
  actualAmountMinor: number;
};

export type BudgetTracking = Omit<Budget, "allocations"> & {
  allocations: BudgetTrackingAllocation[];
  debtActualPaymentMinor: number;
};

export type CreateBudgetInput = {
  periodKind: PeriodKind;
  periodStart: string;
  periodEnd: string;
  totalAmountMinor: number;
  debtBudgetMinor?: number;
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
    debtBudgetMinor: row.debt_budget_amount_minor ?? 0,
    allocatedAmountMinor: allocatedAmountMinor + (row.debt_budget_amount_minor ?? 0),
    unallocatedAmountMinor: row.total_amount_minor - allocatedAmountMinor - (row.debt_budget_amount_minor ?? 0),
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
    const nextMonthDays = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 0)).getUTCDate();
    const nextMonth = new Date(Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth() + 1,
      Math.min(start.getUTCDate(), nextMonthDays),
    ));
    if (end.getTime() !== nextMonth.getTime()) {
      throw new LocalDbError("VALIDATION_ERROR", "MONTHLY budgets must cover one month from the start date");
    }
  }
  if (input.periodKind === "CUSTOM" && periodDays > 366) {
    throw new LocalDbError("VALIDATION_ERROR", "CUSTOM budgets cannot exceed 366 days");
  }
  if (input.allocations.length > 100) throw new LocalDbError("VALIDATION_ERROR", "allocations cannot contain more than 100 items");
  if (!Number.isInteger(input.totalAmountMinor) || input.totalAmountMinor <= 0) {
    throw new LocalDbError("VALIDATION_ERROR", "totalAmountMinor must be a positive integer");
  }
  if (!Number.isInteger(input.debtBudgetMinor ?? 0) || (input.debtBudgetMinor ?? 0) < 0) {
    throw new LocalDbError("VALIDATION_ERROR", "debtBudgetMinor must be a non-negative integer");
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
  const debtBudget = input.periodKind === "MONTHLY" ? (input.debtBudgetMinor ?? 0) : 0;
  if (total + debtBudget > input.totalAmountMinor) {
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

async function validateAllocationReferences(db: SQLite.SQLiteDatabase, userId: string, allocations: CreateBudgetInput["allocations"]): Promise<void> {
  const categoryIds = [...new Set(allocations.map((allocation) => allocation.categoryId).filter((id): id is string => Boolean(id)))];
  const subcategoryIds = [...new Set(allocations.map((allocation) => allocation.subcategoryId).filter((id): id is string => Boolean(id)))];
  const [categoryRows, subcategoryRows] = await Promise.all([
    categoryIds.length ? db.getAllAsync<{ id: string }>(`SELECT id FROM categories WHERE (user_id = ? OR is_system = 1) AND id IN (${categoryIds.map(() => "?").join(",")}) AND deleted = 0 AND is_active = 1`, userId, ...categoryIds) : [],
    subcategoryIds.length ? db.getAllAsync<{ id: string }>(`SELECT id FROM subcategories WHERE (user_id = ? OR is_system = 1) AND id IN (${subcategoryIds.map(() => "?").join(",")}) AND deleted = 0 AND is_active = 1 AND kind = 'expense'`, userId, ...subcategoryIds) : [],
  ]);
  const categories = categoryRows ?? [];
  const subcategories = subcategoryRows ?? [];
  if (categories.length !== categoryIds.length || subcategories.length !== subcategoryIds.length) throw new LocalDbError("VALIDATION_ERROR", "allocation reference is not accessible");
}

export async function listBudgetDrafts(userId: string): Promise<Budget[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BudgetRow>(
    "SELECT * FROM budgets WHERE user_id = ? AND status = 'draft' AND deleted = 0 ORDER BY period_start DESC, created_at DESC",
    userId,
  );
  const allocations = await db.getAllAsync<AllocationRow>(
    "SELECT * FROM budget_allocations WHERE user_id = ? AND deleted = 0 ORDER BY budget_id, rowid",
    userId,
  );
  const allocationsByBudget = new Map<string, AllocationRow[]>();
  for (const allocation of allocations) {
    const budgetAllocations = allocationsByBudget.get(allocation.budget_id) ?? [];
    budgetAllocations.push(allocation);
    allocationsByBudget.set(allocation.budget_id, budgetAllocations);
  }
  return rows.map((row) => mapBudget(row, allocationsByBudget.get(row.id) ?? []));
}

export async function getBudgetDraft(userId: string, id: string): Promise<Budget | null> {
  return readBudget(await getDb(), userId, id);
}

export async function getCurrentBudgetDraft(userId: string, asOfDate: string): Promise<Budget | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM budgets WHERE user_id = ? AND status = 'draft' AND deleted = 0 AND period_kind = 'MONTHLY' AND period_start <= ? AND period_end >= ? ORDER BY updated_at DESC LIMIT 1",
    userId, asOfDate, asOfDate,
  );
  return row ? readBudget(db, userId, row.id) : null;
}

export async function getBudgetDraftTracking(userId: string, id: string): Promise<BudgetTracking | null> {
  const db = await getDb();
  const budget = await readBudget(db, userId, id);
  if (!budget) return null;

  const rows = await db.getAllAsync<{ id: string; actual_amount_minor: number }>(
    `SELECT ba.id, COALESCE(SUM(t.amount_centavos), 0) AS actual_amount_minor
       FROM budget_allocations ba
        LEFT JOIN transactions t ON t.user_id = ?
          AND t.transaction_type = 'expense' AND t.status = 'posted' AND t.deleted = 0
           AND t.transaction_date >= ? AND t.transaction_date < ?
          AND NOT EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.transaction_id = t.id AND dp.user_id = ? AND dp.deleted = 0)
         AND (
           (ba.subcategory_id IS NOT NULL AND t.subcategory_id = ba.subcategory_id AND EXISTS (
             SELECT 1 FROM subcategories s
              WHERE s.id = ba.subcategory_id AND (s.user_id = ? OR s.is_system = 1) AND s.deleted = 0
                AND s.is_active = 1 AND s.kind = 'expense'
           ))
           OR (ba.category_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM subcategories s
              WHERE s.id = t.subcategory_id AND s.category_id = ba.category_id
                 AND (s.user_id = ? OR s.is_system = 1) AND s.deleted = 0 AND s.is_active = 1
                 AND s.kind = 'expense'
           ) AND EXISTS (
             SELECT 1 FROM categories c
              WHERE c.id = ba.category_id AND (c.user_id = ? OR c.is_system = 1)
                AND c.deleted = 0 AND c.is_active = 1
           ))
         )
       WHERE ba.user_id = ? AND ba.budget_id = ? AND ba.deleted = 0
         AND (ba.subcategory_id IS NULL OR EXISTS (
           SELECT 1 FROM subcategories ba_subcategory
            WHERE ba_subcategory.id = ba.subcategory_id
              AND (ba_subcategory.user_id = ? OR ba_subcategory.is_system = 1)
              AND ba_subcategory.deleted = 0 AND ba_subcategory.is_active = 1
         ))
         AND (ba.category_id IS NULL OR EXISTS (
           SELECT 1 FROM categories ba_category
            WHERE ba_category.id = ba.category_id
              AND (ba_category.user_id = ? OR ba_category.is_system = 1)
              AND ba_category.deleted = 0 AND ba_category.is_active = 1
         ))
      GROUP BY ba.id
      ORDER BY ba.rowid`,
    userId,
    budget.periodStart,
    budget.periodEnd,
    userId,
    userId,
    userId,
    userId,
    userId,
    id,
    userId,
    userId,
  );
  const actualByAllocation = new Map(rows.map((row) => [row.id, row.actual_amount_minor]));
  const debtActual = await db.getFirstAsync<{ total_minor: number }>(
    "SELECT COALESCE(SUM(amount_centavos), 0) AS total_minor FROM debt_payments WHERE user_id=? AND payment_date>=? AND payment_date<? AND deleted=0",
    userId, budget.periodStart, budget.periodEnd,
  );
  return {
    ...budget,
    debtActualPaymentMinor: debtActual?.total_minor ?? 0,
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
    await validateAllocationReferences(db, userId, input.allocations);

    await db.runAsync(
      `INSERT INTO budgets
        (id, user_id, status, allocation_method, period_kind, period_start, period_end,
         budget_period_days, total_amount_minor, surplus_handling, deficit_handling,
         allow_deficit_planning, debt_budget_amount_minor, version, deleted, created_at, updated_at)
       VALUES (?, ?, 'draft', 'MANUAL', ?, ?, ?, ?, ?, 'LEAVE_UNALLOCATED', 'BLOCK_ACTIVATION', 0, ?, 1, 0, ?, ?)`,
      budgetId, userId, input.periodKind, input.periodStart, input.periodEnd, periodDays,
       input.totalAmountMinor, input.periodKind === "MONTHLY" ? (input.debtBudgetMinor ?? 0) : 0, timestamp, timestamp,
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
      debt_budget_amount_minor: input.periodKind === "MONTHLY" ? (input.debtBudgetMinor ?? 0) : 0,
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

export async function updateBudgetDraft(
  userId: string,
  deviceId: string,
  id: string,
  input: CreateBudgetInput,
): Promise<{ budget: Budget; operation: SyncOperation }> {
  const periodDays = validateInput(input);
  const db = await getDb();
  const allocationIds = input.allocations.map(() => randomUUID());
  let result: { budget: Budget; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<BudgetRow>(
      "SELECT * FROM budgets WHERE user_id = ? AND id = ? AND status = 'draft' AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Budget draft not found");

    await validateAllocationReferences(db, userId, input.allocations);

    const timestamp = new Date().toISOString();
    await db.runAsync(
      `UPDATE budgets SET period_kind = ?, period_start = ?, period_end = ?, budget_period_days = ?,
        total_amount_minor = ?, debt_budget_amount_minor = ?, version = version + 1, updated_at = ?
       WHERE user_id = ? AND id = ?`,
      input.periodKind, input.periodStart, input.periodEnd, periodDays, input.totalAmountMinor,
      input.periodKind === "MONTHLY" ? (input.debtBudgetMinor ?? 0) : 0, timestamp, userId, id,
    );
    await db.runAsync("UPDATE budget_allocations SET deleted = 1, version = version + 1, updated_at = ? WHERE user_id = ? AND budget_id = ? AND deleted = 0", timestamp, userId, id);
    for (const [index, allocation] of input.allocations.entries()) {
      await db.runAsync(
        `INSERT INTO budget_allocations
          (id, user_id, budget_id, category_id, subcategory_id, allocated_amount_minor,
           restriction_level, version, deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'OPEN', 1, 0, ?, ?)`,
        allocationIds[index]!, userId, id, allocation.categoryId ?? null,
        allocation.subcategoryId ?? null, allocation.amountMinor, timestamp, timestamp,
      );
    }

     const debtBudgetMinor = input.periodKind === "MONTHLY" ? (input.debtBudgetMinor ?? 0) : 0;
     const payload = {
       id, user_id: userId, status: "draft", allocation_method: "MANUAL", ...input,
       debt_budget_amount_minor: debtBudgetMinor,
      budget_period_days: periodDays, surplus_handling: "LEAVE_UNALLOCATED", deficit_handling: "BLOCK_ACTIVATION",
      allow_deficit_planning: false,
      allocations: input.allocations.map((allocation, index) => ({ id: allocationIds[index], ...allocation })),
    };
    const operation = await enqueueOperation(db, {
      userId, deviceId, entity: "budgets", recordId: id, operationType: "update", baseVersion: current.version,
      changedFields: ["period_kind", "period_start", "period_end", "budget_period_days", "total_amount_minor", "debt_budget_amount_minor", "allocations"],
      payload, failureMessage: "This budget draft could not be updated.",
    });
    result = { budget: (await readBudget(db, userId, id))!, operation };
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
