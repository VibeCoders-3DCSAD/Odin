import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import { randomUUID } from "../uuid";
import type { SyncOperation } from "../types";

// ---------------------------------------------------------------------------
// Row types — raw SQLite columns
// ---------------------------------------------------------------------------

type FinancialAccountRow = {
  id: string;
  user_id: string;
  name: string;
  kind: string;
  status: string;
  opening_balance_centavos: number;
  current_balance_centavos: number;
  credit_limit_centavos: number | null;
  include_in_dashboard_balance: number;
  institution_name: string | null;
  opened_on: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  sort_order: number;
  metadata: string;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

type IncomeSourceRow = {
  id: string;
  user_id: string;
  name: string;
  income_type: string;
  frequency: string;
  expected_amount_centavos: number | null;
  min_amount_centavos: number | null;
  max_amount_centavos: number | null;
  payday_day_of_month: number | null;
  payday_second_day_of_month: number | null;
  payday_day_of_week: number | null;
  payday_second_day_of_week: number | null;
  next_expected_date: string | null;
  estimated_interval_days: number | null;
  is_active: number;
  notes: string | null;
  metadata: string;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

type FinancialObligationRow = {
  id: string;
  user_id: string;
  subcategory_id: string;
  recurring_template_id: string | null;
  name: string;
  status: string;
  amount_centavos: number;
  frequency: string;
  due_day_of_month: number | null;
  due_second_day_of_month: number | null;
  due_day_of_week: number | null;
  due_second_day_of_week: number | null;
  due_month: number | null;
  is_family_support: number;
  is_dependent_support: number;
  protected_by_default: number;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  metadata: string;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type FinancialAccountKind =
  | "cash"
  | "bank"
  | "e_wallet"
  | "savings"
  | "credit_card"
  | "loan"
  | "other";

export type FinancialAccountStatus = "active" | "archived";

export type FinancialAccount = {
  id: string;
  name: string;
  kind: FinancialAccountKind;
  status: FinancialAccountStatus;
  openingBalanceCentavos: number;
  currentBalanceCentavos: number;
  creditLimitCentavos: number | null;
  includeInDashboardBalance: boolean;
  institutionName: string | null;
  openedOn: string | null;
  archivedAt: string | null;
  sortOrder: number;
};

export type IncomeType = "stable" | "variable";

export type IncomeFrequency =
  | "weekly"
  | "biweekly"
  | "semi_monthly"
  | "monthly"
  | "irregular"
  | "custom";

export type IncomeSource = {
  id: string;
  name: string;
  incomeType: IncomeType;
  frequency: IncomeFrequency;
  expectedAmountCentavos: number | null;
  minAmountCentavos: number | null;
  maxAmountCentavos: number | null;
  paydayDayOfMonth: number | null;
  paydaySecondDayOfMonth: number | null;
  paydayDayOfWeek: number | null;
  paydaySecondDayOfWeek: number | null;
  nextExpectedDate: string | null;
  estimatedIntervalDays: number | null;
  isActive: boolean;
  notes: string | null;
};

export type ObligationFrequency =
  | "weekly"
  | "biweekly"
  | "semi_monthly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export type FinancialObligation = {
  id: string;
  subcategoryId: string;
  recurringTemplateId: string | null;
  name: string;
  amountCentavos: number;
  frequency: ObligationFrequency;
  dueDayOfMonth: number | null;
  dueSecondDayOfMonth: number | null;
  dueDayOfWeek: number | null;
  dueSecondDayOfWeek: number | null;
  dueMonth: number | null;
  isFamilySupport: boolean;
  isDependentSupport: boolean;
  protectedByDefault: boolean;
  startsOn: string | null;
  endsOn: string | null;
  notes: string | null;
};

// ---------------------------------------------------------------------------
// Create / update inputs
// ---------------------------------------------------------------------------

export type CreateFinancialAccountInput = {
  name: string;
  kind: FinancialAccountKind;
  openingBalanceCentavos?: number;
  creditLimitCentavos?: number | null;
  includeInDashboardBalance?: boolean;
  institutionName?: string | null;
  openedOn?: string | null;
  sortOrder?: number;
};

export type UpdateFinancialAccountInput = {
  name?: string;
  status?: FinancialAccountStatus;
  openingBalanceCentavos?: number;
  currentBalanceCentavos?: number;
  creditLimitCentavos?: number | null;
  includeInDashboardBalance?: boolean;
  institutionName?: string | null;
  openedOn?: string | null;
  archivedAt?: string | null;
  sortOrder?: number;
};

export type CreateIncomeSourceInput = {
  name: string;
  incomeType: IncomeType;
  frequency: IncomeFrequency;
  expectedAmountCentavos?: number | null;
  minAmountCentavos?: number | null;
  maxAmountCentavos?: number | null;
  paydayDayOfMonth?: number | null;
  paydaySecondDayOfMonth?: number | null;
  paydayDayOfWeek?: number | null;
  paydaySecondDayOfWeek?: number | null;
  nextExpectedDate?: string | null;
  estimatedIntervalDays?: number | null;
  isActive?: boolean;
  notes?: string | null;
};

export type UpdateIncomeSourceInput = {
  name?: string;
  incomeType?: IncomeType;
  frequency?: IncomeFrequency;
  expectedAmountCentavos?: number | null;
  minAmountCentavos?: number | null;
  maxAmountCentavos?: number | null;
  paydayDayOfMonth?: number | null;
  paydaySecondDayOfMonth?: number | null;
  paydayDayOfWeek?: number | null;
  paydaySecondDayOfWeek?: number | null;
  nextExpectedDate?: string | null;
  estimatedIntervalDays?: number | null;
  isActive?: boolean;
  notes?: string | null;
};

export type CreateFinancialObligationInput = {
  subcategoryId: string;
  recurringTemplateId?: string | null;
  name: string;
  amountCentavos: number;
  frequency: ObligationFrequency;
  dueDayOfMonth?: number | null;
  dueSecondDayOfMonth?: number | null;
  dueDayOfWeek?: number | null;
  dueSecondDayOfWeek?: number | null;
  dueMonth?: number | null;
  isFamilySupport?: boolean;
  isDependentSupport?: boolean;
  protectedByDefault?: boolean;
  startsOn?: string | null;
  endsOn?: string | null;
  notes?: string | null;
};

export type UpdateFinancialObligationInput = {
  subcategoryId?: string;
  recurringTemplateId?: string | null;
  name?: string;
  amountCentavos?: number;
  frequency?: ObligationFrequency;
  dueDayOfMonth?: number | null;
  dueSecondDayOfMonth?: number | null;
  dueDayOfWeek?: number | null;
  dueSecondDayOfWeek?: number | null;
  dueMonth?: number | null;
  isFamilySupport?: boolean;
  isDependentSupport?: boolean;
  protectedByDefault?: boolean;
  startsOn?: string | null;
  endsOn?: string | null;
  notes?: string | null;
};

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapAccount(row: FinancialAccountRow): FinancialAccount {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as FinancialAccountKind,
    status: row.status as FinancialAccountStatus,
    openingBalanceCentavos: row.opening_balance_centavos,
    currentBalanceCentavos: row.current_balance_centavos,
    creditLimitCentavos: row.credit_limit_centavos,
    includeInDashboardBalance: row.include_in_dashboard_balance === 1,
    institutionName: row.institution_name,
    openedOn: row.opened_on,
    archivedAt: row.archived_at,
    sortOrder: row.sort_order,
  };
}

function mapIncomeSource(row: IncomeSourceRow): IncomeSource {
  return {
    id: row.id,
    name: row.name,
    incomeType: row.income_type as IncomeType,
    frequency: row.frequency as IncomeFrequency,
    expectedAmountCentavos: row.expected_amount_centavos,
    minAmountCentavos: row.min_amount_centavos,
    maxAmountCentavos: row.max_amount_centavos,
    paydayDayOfMonth: row.payday_day_of_month,
    paydaySecondDayOfMonth: row.payday_second_day_of_month,
    paydayDayOfWeek: row.payday_day_of_week,
    paydaySecondDayOfWeek: row.payday_second_day_of_week,
    nextExpectedDate: row.next_expected_date,
    estimatedIntervalDays: row.estimated_interval_days,
    isActive: row.is_active === 1,
    notes: row.notes,
  };
}

function mapObligation(row: FinancialObligationRow): FinancialObligation {
  return {
    id: row.id,
    subcategoryId: row.subcategory_id,
    recurringTemplateId: row.recurring_template_id,
    name: row.name,
    amountCentavos: row.amount_centavos,
    frequency: row.frequency as ObligationFrequency,
    dueDayOfMonth: row.due_day_of_month,
    dueSecondDayOfMonth: row.due_second_day_of_month,
    dueDayOfWeek: row.due_day_of_week,
    dueSecondDayOfWeek: row.due_second_day_of_week,
    dueMonth: row.due_month,
    isFamilySupport: row.is_family_support === 1,
    isDependentSupport: row.is_dependent_support === 1,
    protectedByDefault: row.protected_by_default === 1,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    notes: row.notes,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function boolToInt(v: boolean | undefined | null): number {
  return v ? 1 : 0;
}

function now(): string {
  return new Date().toISOString();
}

async function assertAccessibleRecurringTemplate(
  db: SQLite.SQLiteDatabase,
  userId: string,
  recurringTemplateId: string,
): Promise<void> {
  const template = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM recurring_transaction_templates WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    recurringTemplateId,
  );
  if (!template) {
    throw new LocalDbError(
      "VALIDATION_ERROR",
      "recurringTemplateId does not reference an accessible recurring transaction template",
    );
  }
}

const VALID_ACCOUNT_KINDS: FinancialAccountKind[] = [
  "cash",
  "bank",
  "e_wallet",
  "savings",
  "credit_card",
  "loan",
  "other",
];

const VALID_ACCOUNT_STATUSES: FinancialAccountStatus[] = [
  "active",
  "archived",
];

const VALID_INCOME_TYPES: IncomeType[] = ["stable", "variable"];

const VALID_INCOME_FREQUENCIES: IncomeFrequency[] = [
  "weekly",
  "biweekly",
  "semi_monthly",
  "monthly",
  "irregular",
  "custom",
];

const VALID_OBLIGATION_FREQUENCIES: ObligationFrequency[] = [
  "weekly",
  "biweekly",
  "semi_monthly",
  "monthly",
  "quarterly",
  "yearly",
  "custom",
];

// ---------------------------------------------------------------------------
// Financial Accounts
// ---------------------------------------------------------------------------

export async function listFinancialAccounts(userId: string): Promise<FinancialAccount[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FinancialAccountRow>(
    "SELECT * FROM financial_accounts WHERE user_id = ? AND deleted = 0 ORDER BY sort_order",
    userId,
  );
  return rows.map(mapAccount);
}

export async function getFinancialAccount(
  userId: string,
  id: string,
): Promise<FinancialAccount | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<FinancialAccountRow>(
    "SELECT * FROM financial_accounts WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    id,
  );
  return row ? mapAccount(row) : null;
}

export async function createFinancialAccount(
  userId: string,
  deviceId: string,
  input: CreateFinancialAccountInput,
): Promise<{ account: FinancialAccount; operation: SyncOperation }> {
  if (!input.name || !input.kind) {
    throw new LocalDbError("VALIDATION_ERROR", "name and kind are required");
  }
  if (!VALID_ACCOUNT_KINDS.includes(input.kind)) {
    throw new LocalDbError("VALIDATION_ERROR", `kind must be one of: ${VALID_ACCOUNT_KINDS.join(", ")}`);
  }
  if (input.creditLimitCentavos !== undefined && input.creditLimitCentavos !== null && input.creditLimitCentavos < 0) {
    throw new LocalDbError("VALIDATION_ERROR", "creditLimitCentavos must be >= 0");
  }

  const db = await getDb();
  const id = randomUUID();
  const ts = now();
  const payload: Record<string, unknown> = {
    name: input.name,
    kind: input.kind,
    opening_balance_centavos: input.openingBalanceCentavos ?? 0,
    credit_limit_centavos: input.creditLimitCentavos ?? null,
    include_in_dashboard_balance: input.includeInDashboardBalance ?? true,
    institution_name: input.institutionName ?? null,
    opened_on: input.openedOn ?? null,
    sort_order: input.sortOrder ?? 0,
  };

  let result: { account: FinancialAccount; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO financial_accounts
        (id, user_id, name, kind, status, opening_balance_centavos, current_balance_centavos,
         credit_limit_centavos, include_in_dashboard_balance, institution_name, opened_on,
         sort_order, metadata, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, '{}', 1, 0, ?, ?)`,
      id,
      userId,
      input.name,
      input.kind,
      input.openingBalanceCentavos ?? 0,
      input.openingBalanceCentavos ?? 0,
      input.creditLimitCentavos ?? null,
      boolToInt(input.includeInDashboardBalance ?? true),
      input.institutionName ?? null,
      input.openedOn ?? null,
      input.sortOrder ?? 0,
      ts,
      ts,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "financial_accounts",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: Object.keys(payload),
      payload,
      failureMessage: `This financial account "${input.name}" could not be created.`,
    });

    const row = await db.getFirstAsync<FinancialAccountRow>(
      "SELECT * FROM financial_accounts WHERE id = ?",
      id,
    );
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read created account");
    result = { account: mapAccount(row), operation };
  });

  return result!;
}

export async function updateFinancialAccount(
  userId: string,
  deviceId: string,
  id: string,
  input: UpdateFinancialAccountInput,
): Promise<{ account: FinancialAccount; operation: SyncOperation }> {
  if (input.status && !VALID_ACCOUNT_STATUSES.includes(input.status)) {
    throw new LocalDbError("VALIDATION_ERROR", "status must be active or archived");
  }
  if (input.creditLimitCentavos !== undefined && input.creditLimitCentavos !== null && input.creditLimitCentavos < 0) {
    throw new LocalDbError("VALIDATION_ERROR", "creditLimitCentavos must be >= 0");
  }

  const db = await getDb();
  const ts = now();
  const changedFields: string[] = [];
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) { changedFields.push("name"); payload.name = input.name; }
  if (input.status !== undefined) { changedFields.push("status"); payload.status = input.status; }
  if (input.openingBalanceCentavos !== undefined) { changedFields.push("opening_balance_centavos"); payload.opening_balance_centavos = input.openingBalanceCentavos; }
  if (input.currentBalanceCentavos !== undefined) { changedFields.push("current_balance_centavos"); payload.current_balance_centavos = input.currentBalanceCentavos; }
  if (input.creditLimitCentavos !== undefined) { changedFields.push("credit_limit_centavos"); payload.credit_limit_centavos = input.creditLimitCentavos; }
  if (input.includeInDashboardBalance !== undefined) { changedFields.push("include_in_dashboard_balance"); payload.include_in_dashboard_balance = input.includeInDashboardBalance; }
  if (input.institutionName !== undefined) { changedFields.push("institution_name"); payload.institution_name = input.institutionName; }
  if (input.openedOn !== undefined) { changedFields.push("opened_on"); payload.opened_on = input.openedOn; }
  if (input.archivedAt !== undefined) { changedFields.push("archived_at"); payload.archived_at = input.archivedAt; }
  if (input.sortOrder !== undefined) { changedFields.push("sort_order"); payload.sort_order = input.sortOrder; }

  if (changedFields.length === 0) {
    const existing = await getFinancialAccount(userId, id);
    if (!existing) throw new LocalDbError("NOT_FOUND", "account not found");
    return { account: existing, operation: null as unknown as SyncOperation };
  }

  let result: { account: FinancialAccount; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<FinancialAccountRow>(
      "SELECT * FROM financial_accounts WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!existing) throw new LocalDbError("NOT_FOUND", "account not found");

    const setClauses: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];

    if (input.name !== undefined) { setClauses.push("name = ?"); params.push(input.name); }
    if (input.status !== undefined) { setClauses.push("status = ?"); params.push(input.status); }
    if (input.openingBalanceCentavos !== undefined) { setClauses.push("opening_balance_centavos = ?"); params.push(input.openingBalanceCentavos); }
    if (input.currentBalanceCentavos !== undefined) { setClauses.push("current_balance_centavos = ?"); params.push(input.currentBalanceCentavos); }
    if (input.creditLimitCentavos !== undefined) { setClauses.push("credit_limit_centavos = ?"); params.push(input.creditLimitCentavos); }
    if (input.includeInDashboardBalance !== undefined) { setClauses.push("include_in_dashboard_balance = ?"); params.push(boolToInt(input.includeInDashboardBalance)); }
    if (input.institutionName !== undefined) { setClauses.push("institution_name = ?"); params.push(input.institutionName); }
    if (input.openedOn !== undefined) { setClauses.push("opened_on = ?"); params.push(input.openedOn); }
    if (input.archivedAt !== undefined) { setClauses.push("archived_at = ?"); params.push(input.archivedAt); }
    if (input.sortOrder !== undefined) { setClauses.push("sort_order = ?"); params.push(input.sortOrder); }

    setClauses.push("updated_at = ?"); params.push(ts);
    setClauses.push("version = version + 1");
    params.push(id, userId);

    await db.runAsync(
      `UPDATE financial_accounts SET ${setClauses.join(", ")} WHERE id = ? AND user_id = ?`,
      ...params,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "financial_accounts",
      recordId: id,
      operationType: "update",
      baseVersion: existing.version,
      changedFields,
      payload,
      failureMessage: `This financial account "${existing.name}" could not be updated.`,
    });

    const row = await db.getFirstAsync<FinancialAccountRow>(
      "SELECT * FROM financial_accounts WHERE id = ?",
      id,
    );
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read updated account");
    result = { account: mapAccount(row), operation };
  });

  return result!;
}

export async function deleteFinancialAccount(
  userId: string,
  deviceId: string,
  id: string,
): Promise<{ account: FinancialAccount; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { account: FinancialAccount; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<FinancialAccountRow>(
      "SELECT * FROM financial_accounts WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!existing) throw new LocalDbError("NOT_FOUND", "account not found");

    await db.runAsync(
      `UPDATE financial_accounts
       SET deleted = 1, status = 'deleted', deleted_at = ?, updated_at = ?, version = version + 1
       WHERE id = ? AND user_id = ?`,
      ts,
      ts,
      id,
      userId,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "financial_accounts",
      recordId: id,
      operationType: "delete",
      baseVersion: existing.version,
      changedFields: [],
      payload: {},
      failureMessage: `This financial account "${existing.name}" could not be deleted.`,
    });

    const row = await db.getFirstAsync<FinancialAccountRow>(
      "SELECT * FROM financial_accounts WHERE id = ?",
      id,
    );
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read deleted account");
    result = { account: mapAccount(row), operation };
  });

  return result!;
}

// ---------------------------------------------------------------------------
// Income Sources
// ---------------------------------------------------------------------------

export async function listIncomeSources(userId: string): Promise<IncomeSource[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<IncomeSourceRow>(
    "SELECT * FROM income_sources WHERE user_id = ? AND deleted = 0 ORDER BY name",
    userId,
  );
  return rows.map(mapIncomeSource);
}

export async function getIncomeSource(
  userId: string,
  id: string,
): Promise<IncomeSource | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<IncomeSourceRow>(
    "SELECT * FROM income_sources WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    id,
  );
  return row ? mapIncomeSource(row) : null;
}

export async function createIncomeSource(
  userId: string,
  deviceId: string,
  input: CreateIncomeSourceInput,
): Promise<{ source: IncomeSource; operation: SyncOperation }> {
  if (!input.name || !input.incomeType || !input.frequency) {
    throw new LocalDbError("VALIDATION_ERROR", "name, incomeType, and frequency are required");
  }
  if (!VALID_INCOME_TYPES.includes(input.incomeType)) {
    throw new LocalDbError("VALIDATION_ERROR", `incomeType must be one of: ${VALID_INCOME_TYPES.join(", ")}`);
  }
  if (!VALID_INCOME_FREQUENCIES.includes(input.frequency)) {
    throw new LocalDbError("VALIDATION_ERROR", `frequency must be one of: ${VALID_INCOME_FREQUENCIES.join(", ")}`);
  }
  if (input.expectedAmountCentavos !== undefined && input.expectedAmountCentavos !== null && input.expectedAmountCentavos < 0) {
    throw new LocalDbError("VALIDATION_ERROR", "expectedAmountCentavos must be >= 0");
  }
  if (input.minAmountCentavos !== undefined && input.minAmountCentavos !== null && input.minAmountCentavos < 0) {
    throw new LocalDbError("VALIDATION_ERROR", "minAmountCentavos must be >= 0");
  }
  if (input.maxAmountCentavos !== undefined && input.maxAmountCentavos !== null && input.maxAmountCentavos < 0) {
    throw new LocalDbError("VALIDATION_ERROR", "maxAmountCentavos must be >= 0");
  }
  const minVal = input.minAmountCentavos;
  const maxVal = input.maxAmountCentavos;
  if (minVal !== undefined && minVal !== null && maxVal !== undefined && maxVal !== null && minVal > maxVal) {
    throw new LocalDbError("VALIDATION_ERROR", "minAmountCentavos must be <= maxAmountCentavos");
  }
  if (input.paydayDayOfMonth !== undefined && input.paydayDayOfMonth !== null && (input.paydayDayOfMonth < 1 || input.paydayDayOfMonth > 31)) {
    throw new LocalDbError("VALIDATION_ERROR", "paydayDayOfMonth must be between 1 and 31");
  }
  if (input.paydaySecondDayOfMonth !== undefined && input.paydaySecondDayOfMonth !== null && (input.paydaySecondDayOfMonth < 1 || input.paydaySecondDayOfMonth > 31)) {
    throw new LocalDbError("VALIDATION_ERROR", "paydaySecondDayOfMonth must be between 1 and 31");
  }
  if (input.paydayDayOfWeek !== undefined && input.paydayDayOfWeek !== null && (input.paydayDayOfWeek < 0 || input.paydayDayOfWeek > 6)) {
    throw new LocalDbError("VALIDATION_ERROR", "paydayDayOfWeek must be between 0 and 6");
  }
  if (input.paydaySecondDayOfWeek !== undefined && input.paydaySecondDayOfWeek !== null && (input.paydaySecondDayOfWeek < 0 || input.paydaySecondDayOfWeek > 6)) {
    throw new LocalDbError("VALIDATION_ERROR", "paydaySecondDayOfWeek must be between 0 and 6");
  }

  const db = await getDb();
  const id = randomUUID();
  const ts = now();
  const payload: Record<string, unknown> = {
    name: input.name,
    income_type: input.incomeType,
    frequency: input.frequency,
    expected_amount_centavos: input.expectedAmountCentavos ?? null,
    min_amount_centavos: input.minAmountCentavos ?? null,
    max_amount_centavos: input.maxAmountCentavos ?? null,
    payday_day_of_month: input.paydayDayOfMonth ?? null,
    payday_second_day_of_month: input.paydaySecondDayOfMonth ?? null,
    payday_day_of_week: input.paydayDayOfWeek ?? null,
    payday_second_day_of_week: input.paydaySecondDayOfWeek ?? null,
    next_expected_date: input.nextExpectedDate ?? null,
    estimated_interval_days: input.estimatedIntervalDays ?? null,
    is_active: input.isActive ?? true,
    notes: input.notes ?? null,
  };

  let result: { source: IncomeSource; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO income_sources
        (id, user_id, name, income_type, frequency, expected_amount_centavos, min_amount_centavos,
         max_amount_centavos, payday_day_of_month, payday_second_day_of_month, payday_day_of_week,
         next_expected_date, estimated_interval_days, payday_second_day_of_week, is_active, notes, metadata, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 1, 0, ?, ?)`,
      id,
      userId,
      input.name,
      input.incomeType,
      input.frequency,
      input.expectedAmountCentavos ?? null,
      input.minAmountCentavos ?? null,
      input.maxAmountCentavos ?? null,
      input.paydayDayOfMonth ?? null,
      input.paydaySecondDayOfMonth ?? null,
      input.paydayDayOfWeek ?? null,
      input.nextExpectedDate ?? null,
      input.estimatedIntervalDays ?? null,
      input.paydaySecondDayOfWeek ?? null,
      boolToInt(input.isActive ?? true),
      input.notes ?? null,
      ts,
      ts,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "income_sources",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: Object.keys(payload),
      payload,
      failureMessage: `This income source "${input.name}" could not be created.`,
    });

    const row = await db.getFirstAsync<IncomeSourceRow>(
      "SELECT * FROM income_sources WHERE id = ?",
      id,
    );
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read created income source");
    result = { source: mapIncomeSource(row), operation };
  });

  return result!;
}

export async function updateIncomeSource(
  userId: string,
  deviceId: string,
  id: string,
  input: UpdateIncomeSourceInput,
): Promise<{ source: IncomeSource; operation: SyncOperation }> {
  if (input.incomeType && !VALID_INCOME_TYPES.includes(input.incomeType)) {
    throw new LocalDbError("VALIDATION_ERROR", `incomeType must be one of: ${VALID_INCOME_TYPES.join(", ")}`);
  }
  if (input.frequency && !VALID_INCOME_FREQUENCIES.includes(input.frequency)) {
    throw new LocalDbError("VALIDATION_ERROR", `frequency must be one of: ${VALID_INCOME_FREQUENCIES.join(", ")}`);
  }
  if (input.expectedAmountCentavos !== undefined && input.expectedAmountCentavos !== null && input.expectedAmountCentavos < 0) {
    throw new LocalDbError("VALIDATION_ERROR", "expectedAmountCentavos must be >= 0");
  }
  if (input.minAmountCentavos !== undefined && input.minAmountCentavos !== null && input.minAmountCentavos < 0) {
    throw new LocalDbError("VALIDATION_ERROR", "minAmountCentavos must be >= 0");
  }
  if (input.maxAmountCentavos !== undefined && input.maxAmountCentavos !== null && input.maxAmountCentavos < 0) {
    throw new LocalDbError("VALIDATION_ERROR", "maxAmountCentavos must be >= 0");
  }
  if (input.paydayDayOfMonth !== undefined && input.paydayDayOfMonth !== null && (input.paydayDayOfMonth < 1 || input.paydayDayOfMonth > 31)) {
    throw new LocalDbError("VALIDATION_ERROR", "paydayDayOfMonth must be between 1 and 31");
  }
  if (input.paydaySecondDayOfMonth !== undefined && input.paydaySecondDayOfMonth !== null && (input.paydaySecondDayOfMonth < 1 || input.paydaySecondDayOfMonth > 31)) {
    throw new LocalDbError("VALIDATION_ERROR", "paydaySecondDayOfMonth must be between 1 and 31");
  }
  if (input.paydayDayOfWeek !== undefined && input.paydayDayOfWeek !== null && (input.paydayDayOfWeek < 0 || input.paydayDayOfWeek > 6)) {
    throw new LocalDbError("VALIDATION_ERROR", "paydayDayOfWeek must be between 0 and 6");
  }
  if (input.paydaySecondDayOfWeek !== undefined && input.paydaySecondDayOfWeek !== null && (input.paydaySecondDayOfWeek < 0 || input.paydaySecondDayOfWeek > 6)) {
    throw new LocalDbError("VALIDATION_ERROR", "paydaySecondDayOfWeek must be between 0 and 6");
  }

  const db = await getDb();
  const ts = now();
  const changedFields: string[] = [];
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) { changedFields.push("name"); payload.name = input.name; }
  if (input.incomeType !== undefined) { changedFields.push("income_type"); payload.income_type = input.incomeType; }
  if (input.frequency !== undefined) { changedFields.push("frequency"); payload.frequency = input.frequency; }
  if (input.expectedAmountCentavos !== undefined) { changedFields.push("expected_amount_centavos"); payload.expected_amount_centavos = input.expectedAmountCentavos; }
  if (input.minAmountCentavos !== undefined) { changedFields.push("min_amount_centavos"); payload.min_amount_centavos = input.minAmountCentavos; }
  if (input.maxAmountCentavos !== undefined) { changedFields.push("max_amount_centavos"); payload.max_amount_centavos = input.maxAmountCentavos; }
  if (input.paydayDayOfMonth !== undefined) { changedFields.push("payday_day_of_month"); payload.payday_day_of_month = input.paydayDayOfMonth; }
  if (input.paydaySecondDayOfMonth !== undefined) { changedFields.push("payday_second_day_of_month"); payload.payday_second_day_of_month = input.paydaySecondDayOfMonth; }
  if (input.paydayDayOfWeek !== undefined) { changedFields.push("payday_day_of_week"); payload.payday_day_of_week = input.paydayDayOfWeek; }
  if (input.paydaySecondDayOfWeek !== undefined) { changedFields.push("payday_second_day_of_week"); payload.payday_second_day_of_week = input.paydaySecondDayOfWeek; }
  if (input.nextExpectedDate !== undefined) { changedFields.push("next_expected_date"); payload.next_expected_date = input.nextExpectedDate; }
  if (input.estimatedIntervalDays !== undefined) { changedFields.push("estimated_interval_days"); payload.estimated_interval_days = input.estimatedIntervalDays; }
  if (input.isActive !== undefined) { changedFields.push("is_active"); payload.is_active = input.isActive; }
  if (input.notes !== undefined) { changedFields.push("notes"); payload.notes = input.notes; }

  if (changedFields.length === 0) {
    const existing = await getIncomeSource(userId, id);
    if (!existing) throw new LocalDbError("NOT_FOUND", "income source not found");
    // ponytail: returning without operation when nothing changed, caller treats operation as potentially null
    return { source: existing, operation: null as unknown as SyncOperation };
  }

  let result: { source: IncomeSource; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<IncomeSourceRow>(
      "SELECT * FROM income_sources WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!existing) throw new LocalDbError("NOT_FOUND", "income source not found");

    const effectiveMin = input.minAmountCentavos !== undefined ? input.minAmountCentavos : existing.min_amount_centavos;
    const effectiveMax = input.maxAmountCentavos !== undefined ? input.maxAmountCentavos : existing.max_amount_centavos;
    if (effectiveMin !== null && effectiveMax !== null && effectiveMin! > effectiveMax!) {
      throw new LocalDbError("VALIDATION_ERROR", "minAmountCentavos must be <= maxAmountCentavos");
    }

    const setClauses: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];

    if (input.name !== undefined) { setClauses.push("name = ?"); params.push(input.name); }
    if (input.incomeType !== undefined) { setClauses.push("income_type = ?"); params.push(input.incomeType); }
    if (input.frequency !== undefined) { setClauses.push("frequency = ?"); params.push(input.frequency); }
    if (input.expectedAmountCentavos !== undefined) { setClauses.push("expected_amount_centavos = ?"); params.push(input.expectedAmountCentavos); }
    if (input.minAmountCentavos !== undefined) { setClauses.push("min_amount_centavos = ?"); params.push(input.minAmountCentavos); }
    if (input.maxAmountCentavos !== undefined) { setClauses.push("max_amount_centavos = ?"); params.push(input.maxAmountCentavos); }
    if (input.paydayDayOfMonth !== undefined) { setClauses.push("payday_day_of_month = ?"); params.push(input.paydayDayOfMonth); }
    if (input.paydaySecondDayOfMonth !== undefined) { setClauses.push("payday_second_day_of_month = ?"); params.push(input.paydaySecondDayOfMonth); }
    if (input.paydayDayOfWeek !== undefined) { setClauses.push("payday_day_of_week = ?"); params.push(input.paydayDayOfWeek); }
    if (input.paydaySecondDayOfWeek !== undefined) { setClauses.push("payday_second_day_of_week = ?"); params.push(input.paydaySecondDayOfWeek); }
    if (input.nextExpectedDate !== undefined) { setClauses.push("next_expected_date = ?"); params.push(input.nextExpectedDate); }
    if (input.estimatedIntervalDays !== undefined) { setClauses.push("estimated_interval_days = ?"); params.push(input.estimatedIntervalDays); }
    if (input.isActive !== undefined) { setClauses.push("is_active = ?"); params.push(boolToInt(input.isActive)); }
    if (input.notes !== undefined) { setClauses.push("notes = ?"); params.push(input.notes); }

    setClauses.push("updated_at = ?"); params.push(ts);
    setClauses.push("version = version + 1");
    params.push(id, userId);

    await db.runAsync(
      `UPDATE income_sources SET ${setClauses.join(", ")} WHERE id = ? AND user_id = ?`,
      ...params,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "income_sources",
      recordId: id,
      operationType: "update",
      baseVersion: existing.version,
      changedFields,
      payload,
      failureMessage: `This income source "${existing.name}" could not be updated.`,
    });

    const row = await db.getFirstAsync<IncomeSourceRow>(
      "SELECT * FROM income_sources WHERE id = ?",
      id,
    );
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read updated income source");
    result = { source: mapIncomeSource(row), operation };
  });

  return result!;
}

export async function deleteIncomeSource(
  userId: string,
  deviceId: string,
  id: string,
): Promise<{ source: IncomeSource; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { source: IncomeSource; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<IncomeSourceRow>(
      "SELECT * FROM income_sources WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!existing) throw new LocalDbError("NOT_FOUND", "income source not found");

    await db.runAsync(
      `UPDATE income_sources
       SET deleted = 1, is_active = 0, updated_at = ?, version = version + 1
       WHERE id = ? AND user_id = ?`,
      ts,
      id,
      userId,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "income_sources",
      recordId: id,
      operationType: "delete",
      baseVersion: existing.version,
      changedFields: [],
      payload: {},
      failureMessage: `This income source "${existing.name}" could not be deleted.`,
    });

    const row = await db.getFirstAsync<IncomeSourceRow>(
      "SELECT * FROM income_sources WHERE id = ?",
      id,
    );
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read deleted income source");
    result = { source: mapIncomeSource(row), operation };
  });

  return result!;
}

// ---------------------------------------------------------------------------
// Financial Obligations
// ---------------------------------------------------------------------------

export async function listFinancialObligations(
  userId: string,
): Promise<FinancialObligation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FinancialObligationRow>(
    "SELECT * FROM financial_obligations WHERE user_id = ? AND deleted = 0 ORDER BY name",
    userId,
  );
  return rows.map(mapObligation);
}

export async function getFinancialObligation(
  userId: string,
  id: string,
): Promise<FinancialObligation | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<FinancialObligationRow>(
    "SELECT * FROM financial_obligations WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    id,
  );
  return row ? mapObligation(row) : null;
}

export async function createFinancialObligation(
  userId: string,
  deviceId: string,
  input: CreateFinancialObligationInput,
): Promise<{ obligation: FinancialObligation; operation: SyncOperation }> {
  if (!input.subcategoryId || !input.name || input.amountCentavos === undefined || !input.frequency) {
    throw new LocalDbError("VALIDATION_ERROR", "subcategoryId, name, amountCentavos, and frequency are required");
  }
  if (input.amountCentavos < 0) {
    throw new LocalDbError("VALIDATION_ERROR", "amountCentavos must be >= 0");
  }
  if (!VALID_OBLIGATION_FREQUENCIES.includes(input.frequency)) {
    throw new LocalDbError("VALIDATION_ERROR", `frequency must be one of: ${VALID_OBLIGATION_FREQUENCIES.join(", ")}`);
  }
  if (input.dueDayOfMonth !== undefined && input.dueDayOfMonth !== null && (input.dueDayOfMonth < 1 || input.dueDayOfMonth > 31)) {
    throw new LocalDbError("VALIDATION_ERROR", "dueDayOfMonth must be between 1 and 31");
  }
  if (input.dueSecondDayOfMonth !== undefined && input.dueSecondDayOfMonth !== null && (input.dueSecondDayOfMonth < 1 || input.dueSecondDayOfMonth > 31)) {
    throw new LocalDbError("VALIDATION_ERROR", "dueSecondDayOfMonth must be between 1 and 31");
  }
  if (input.dueDayOfWeek !== undefined && input.dueDayOfWeek !== null && (input.dueDayOfWeek < 0 || input.dueDayOfWeek > 6)) {
    throw new LocalDbError("VALIDATION_ERROR", "dueDayOfWeek must be between 0 and 6");
  }
  if (input.dueSecondDayOfWeek !== undefined && input.dueSecondDayOfWeek !== null && (input.dueSecondDayOfWeek < 0 || input.dueSecondDayOfWeek > 6)) {
    throw new LocalDbError("VALIDATION_ERROR", "dueSecondDayOfWeek must be between 0 and 6");
  }
  if (input.dueMonth !== undefined && input.dueMonth !== null && (input.dueMonth < 1 || input.dueMonth > 12)) {
    throw new LocalDbError("VALIDATION_ERROR", "dueMonth must be between 1 and 12");
  }
  if (input.startsOn !== undefined && input.startsOn !== null && input.endsOn !== undefined && input.endsOn !== null && input.startsOn > input.endsOn) {
    throw new LocalDbError("VALIDATION_ERROR", "startsOn must be <= endsOn");
  }

  const db = await getDb();
  const id = randomUUID();
  const ts = now();
  const payload: Record<string, unknown> = {
    subcategory_id: input.subcategoryId,
    recurring_template_id: input.recurringTemplateId ?? null,
    name: input.name,
    amount_centavos: input.amountCentavos,
    frequency: input.frequency,
    due_day_of_month: input.dueDayOfMonth ?? null,
    due_second_day_of_month: input.dueSecondDayOfMonth ?? null,
    due_day_of_week: input.dueDayOfWeek ?? null,
    due_second_day_of_week: input.dueSecondDayOfWeek ?? null,
    due_month: input.dueMonth ?? null,
    is_family_support: input.isFamilySupport ?? false,
    is_dependent_support: input.isDependentSupport ?? false,
    protected_by_default: input.protectedByDefault ?? true,
    starts_on: input.startsOn ?? null,
    ends_on: input.endsOn ?? null,
    notes: input.notes ?? null,
  };

  let result: { obligation: FinancialObligation; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const subcategory = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM subcategories WHERE user_id = ? AND id = ? AND kind = 'expense' AND deleted = 0 AND is_active = 1",
      userId,
      input.subcategoryId,
    );
    if (!subcategory) {
      throw new LocalDbError("VALIDATION_ERROR", "subcategoryId does not reference an accessible active expense subcategory");
    }

    if (input.recurringTemplateId != null) {
      await assertAccessibleRecurringTemplate(db, userId, input.recurringTemplateId);
    }

    await db.runAsync(
      `INSERT INTO financial_obligations
        (id, user_id, subcategory_id, recurring_template_id, name, status, amount_centavos,
         frequency, due_day_of_month, due_second_day_of_month, due_day_of_week,
         due_second_day_of_week, due_month, is_family_support, is_dependent_support,
         protected_by_default, starts_on, ends_on, notes,
         metadata, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 1, 0, ?, ?)`,
      id,
      userId,
      input.subcategoryId,
      input.recurringTemplateId ?? null,
      input.name,
      input.amountCentavos,
      input.frequency,
      input.dueDayOfMonth ?? null,
      input.dueSecondDayOfMonth ?? null,
      input.dueDayOfWeek ?? null,
      input.dueSecondDayOfWeek ?? null,
      input.dueMonth ?? null,
      boolToInt(input.isFamilySupport ?? false),
      boolToInt(input.isDependentSupport ?? false),
      boolToInt(input.protectedByDefault ?? true),
      input.startsOn ?? null,
      input.endsOn ?? null,
      input.notes ?? null,
      ts,
      ts,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "financial_obligations",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: Object.keys(payload),
      payload,
      failureMessage: `This financial obligation "${input.name}" could not be created.`,
    });

    const row = await db.getFirstAsync<FinancialObligationRow>(
      "SELECT * FROM financial_obligations WHERE id = ?",
      id,
    );
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read created obligation");
    result = { obligation: mapObligation(row), operation };
  });

  return result!;
}

export async function updateFinancialObligation(
  userId: string,
  deviceId: string,
  id: string,
  input: UpdateFinancialObligationInput,
): Promise<{ obligation: FinancialObligation; operation: SyncOperation }> {
  if (input.frequency && !VALID_OBLIGATION_FREQUENCIES.includes(input.frequency)) {
    throw new LocalDbError("VALIDATION_ERROR", `frequency must be one of: ${VALID_OBLIGATION_FREQUENCIES.join(", ")}`);
  }
  if (input.amountCentavos !== undefined && input.amountCentavos < 0) {
    throw new LocalDbError("VALIDATION_ERROR", "amountCentavos must be >= 0");
  }
  if (input.dueDayOfMonth !== undefined && input.dueDayOfMonth !== null && (input.dueDayOfMonth < 1 || input.dueDayOfMonth > 31)) {
    throw new LocalDbError("VALIDATION_ERROR", "dueDayOfMonth must be between 1 and 31");
  }
  if (input.dueSecondDayOfMonth !== undefined && input.dueSecondDayOfMonth !== null && (input.dueSecondDayOfMonth < 1 || input.dueSecondDayOfMonth > 31)) {
    throw new LocalDbError("VALIDATION_ERROR", "dueSecondDayOfMonth must be between 1 and 31");
  }
  if (input.dueDayOfWeek !== undefined && input.dueDayOfWeek !== null && (input.dueDayOfWeek < 0 || input.dueDayOfWeek > 6)) {
    throw new LocalDbError("VALIDATION_ERROR", "dueDayOfWeek must be between 0 and 6");
  }
  if (input.dueSecondDayOfWeek !== undefined && input.dueSecondDayOfWeek !== null && (input.dueSecondDayOfWeek < 0 || input.dueSecondDayOfWeek > 6)) {
    throw new LocalDbError("VALIDATION_ERROR", "dueSecondDayOfWeek must be between 0 and 6");
  }
  if (input.dueMonth !== undefined && input.dueMonth !== null && (input.dueMonth < 1 || input.dueMonth > 12)) {
    throw new LocalDbError("VALIDATION_ERROR", "dueMonth must be between 1 and 12");
  }

  const db = await getDb();
  const ts = now();
  const changedFields: string[] = [];
  const payload: Record<string, unknown> = {};

  if (input.subcategoryId !== undefined) { changedFields.push("subcategory_id"); payload.subcategory_id = input.subcategoryId; }
  if (input.recurringTemplateId !== undefined) { changedFields.push("recurring_template_id"); payload.recurring_template_id = input.recurringTemplateId; }
  if (input.name !== undefined) { changedFields.push("name"); payload.name = input.name; }
  if (input.amountCentavos !== undefined) { changedFields.push("amount_centavos"); payload.amount_centavos = input.amountCentavos; }
  if (input.frequency !== undefined) { changedFields.push("frequency"); payload.frequency = input.frequency; }
  if (input.dueDayOfMonth !== undefined) { changedFields.push("due_day_of_month"); payload.due_day_of_month = input.dueDayOfMonth; }
  if (input.dueSecondDayOfMonth !== undefined) { changedFields.push("due_second_day_of_month"); payload.due_second_day_of_month = input.dueSecondDayOfMonth; }
  if (input.dueDayOfWeek !== undefined) { changedFields.push("due_day_of_week"); payload.due_day_of_week = input.dueDayOfWeek; }
  if (input.dueSecondDayOfWeek !== undefined) { changedFields.push("due_second_day_of_week"); payload.due_second_day_of_week = input.dueSecondDayOfWeek; }
  if (input.dueMonth !== undefined) { changedFields.push("due_month"); payload.due_month = input.dueMonth; }
  if (input.isFamilySupport !== undefined) { changedFields.push("is_family_support"); payload.is_family_support = input.isFamilySupport; }
  if (input.isDependentSupport !== undefined) { changedFields.push("is_dependent_support"); payload.is_dependent_support = input.isDependentSupport; }
  if (input.protectedByDefault !== undefined) { changedFields.push("protected_by_default"); payload.protected_by_default = input.protectedByDefault; }
  if (input.startsOn !== undefined) { changedFields.push("starts_on"); payload.starts_on = input.startsOn; }
  if (input.endsOn !== undefined) { changedFields.push("ends_on"); payload.ends_on = input.endsOn; }
  if (input.notes !== undefined) { changedFields.push("notes"); payload.notes = input.notes; }

  if (changedFields.length === 0) {
    const existing = await getFinancialObligation(userId, id);
    if (!existing) throw new LocalDbError("NOT_FOUND", "obligation not found");
    return { obligation: existing, operation: null as unknown as SyncOperation };
  }

  let result: { obligation: FinancialObligation; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<FinancialObligationRow>(
      "SELECT * FROM financial_obligations WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!existing) throw new LocalDbError("NOT_FOUND", "obligation not found");

    if (input.subcategoryId !== undefined) {
      const sc = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM subcategories WHERE user_id = ? AND id = ? AND kind = 'expense' AND deleted = 0 AND is_active = 1",
        userId,
        input.subcategoryId,
      );
      if (!sc) throw new LocalDbError("VALIDATION_ERROR", "subcategoryId does not reference an accessible active expense subcategory");
    }
    if (input.recurringTemplateId != null) {
      await assertAccessibleRecurringTemplate(db, userId, input.recurringTemplateId);
    }
    if (input.startsOn !== undefined && input.startsOn !== null && input.endsOn === undefined) {
      if (input.startsOn > existing.ends_on!) {
        throw new LocalDbError("VALIDATION_ERROR", "startsOn must be <= existing endsOn");
      }
    }
    if (input.endsOn !== undefined && input.endsOn !== null && input.startsOn === undefined) {
      if (existing.starts_on! > input.endsOn) {
        throw new LocalDbError("VALIDATION_ERROR", "existing startsOn must be <= endsOn");
      }
    }
    if (input.startsOn !== undefined && input.startsOn !== null && input.endsOn !== undefined && input.endsOn !== null && input.startsOn > input.endsOn) {
      throw new LocalDbError("VALIDATION_ERROR", "startsOn must be <= endsOn");
    }

    const setClauses: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];

    if (input.subcategoryId !== undefined) { setClauses.push("subcategory_id = ?"); params.push(input.subcategoryId); }
    if (input.recurringTemplateId !== undefined) { setClauses.push("recurring_template_id = ?"); params.push(input.recurringTemplateId); }
    if (input.name !== undefined) { setClauses.push("name = ?"); params.push(input.name); }
    if (input.amountCentavos !== undefined) { setClauses.push("amount_centavos = ?"); params.push(input.amountCentavos); }
    if (input.frequency !== undefined) { setClauses.push("frequency = ?"); params.push(input.frequency); }
    if (input.dueDayOfMonth !== undefined) { setClauses.push("due_day_of_month = ?"); params.push(input.dueDayOfMonth); }
    if (input.dueSecondDayOfMonth !== undefined) { setClauses.push("due_second_day_of_month = ?"); params.push(input.dueSecondDayOfMonth); }
    if (input.dueDayOfWeek !== undefined) { setClauses.push("due_day_of_week = ?"); params.push(input.dueDayOfWeek); }
    if (input.dueSecondDayOfWeek !== undefined) { setClauses.push("due_second_day_of_week = ?"); params.push(input.dueSecondDayOfWeek); }
    if (input.dueMonth !== undefined) { setClauses.push("due_month = ?"); params.push(input.dueMonth); }
    if (input.isFamilySupport !== undefined) { setClauses.push("is_family_support = ?"); params.push(boolToInt(input.isFamilySupport)); }
    if (input.isDependentSupport !== undefined) { setClauses.push("is_dependent_support = ?"); params.push(boolToInt(input.isDependentSupport)); }
    if (input.protectedByDefault !== undefined) { setClauses.push("protected_by_default = ?"); params.push(boolToInt(input.protectedByDefault)); }
    if (input.startsOn !== undefined) { setClauses.push("starts_on = ?"); params.push(input.startsOn); }
    if (input.endsOn !== undefined) { setClauses.push("ends_on = ?"); params.push(input.endsOn); }
    if (input.notes !== undefined) { setClauses.push("notes = ?"); params.push(input.notes); }

    setClauses.push("updated_at = ?"); params.push(ts);
    setClauses.push("version = version + 1");
    params.push(id, userId);

    await db.runAsync(
      `UPDATE financial_obligations SET ${setClauses.join(", ")} WHERE id = ? AND user_id = ?`,
      ...params,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "financial_obligations",
      recordId: id,
      operationType: "update",
      baseVersion: existing.version,
      changedFields,
      payload,
      failureMessage: `This financial obligation "${existing.name}" could not be updated.`,
    });

    const row = await db.getFirstAsync<FinancialObligationRow>(
      "SELECT * FROM financial_obligations WHERE id = ?",
      id,
    );
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read updated obligation");
    result = { obligation: mapObligation(row), operation };
  });

  return result!;
}

export async function linkObligationToRecurringTemplate(
  userId: string,
  deviceId: string,
  obligationId: string,
  templateId: string | null,
): Promise<{ obligation: FinancialObligation; operation: SyncOperation }> {
  return updateFinancialObligation(userId, deviceId, obligationId, {
    recurringTemplateId: templateId,
  });
}

export async function automateObligation(
  userId: string,
  deviceId: string,
  obligationId: string,
  overrides?: {
    frequency?: ObligationFrequency;
    dayOfMonth?: number | null;
    dayOfWeek?: number | null;
    startDate?: string;
  },
): Promise<{ obligation: FinancialObligation; template: import("./recurringTransactions").RecurringTemplate; operation: SyncOperation }> {
  const { getRecurringTemplate, createRecurringTemplate } = await import("./recurringTransactions");

  const obligation = await getFinancialObligation(userId, obligationId);
  if (!obligation) throw new LocalDbError("NOT_FOUND", "obligation not found");
  if (obligation.recurringTemplateId) throw new LocalDbError("VALIDATION_ERROR", "obligation already linked to a recurring template");

  let freq = overrides?.frequency ?? obligation.frequency;
  let intervalCount = 1;
  let dayOfMonth = overrides?.dayOfMonth !== undefined ? overrides.dayOfMonth : (obligation.dueDayOfMonth ?? undefined);
  let secondDayOfMonth = obligation.dueSecondDayOfMonth ?? undefined;
  let dayOfWeek = overrides?.dayOfWeek !== undefined ? overrides.dayOfWeek : (obligation.dueDayOfWeek ?? undefined);

  if (freq === "biweekly") {
    freq = "weekly";
    intervalCount = 2;
  } else if (freq === "semi_monthly") {
    freq = "monthly";
  }

  const { template } = await createRecurringTemplate(userId, deviceId, {
    transaction_type: "expense",
    name: obligation.name,
    amount_centavos: obligation.amountCentavos,
    frequency: freq,
    interval_count: intervalCount,
    day_of_month: dayOfMonth ?? undefined,
    second_day_of_month: secondDayOfMonth ?? undefined,
    day_of_week: dayOfWeek ?? undefined,
    starts_on: overrides?.startDate ?? new Date().toISOString().slice(0, 10),
    subcategory_id: obligation.subcategoryId,
    notes: obligation.notes ?? undefined,
  });

  const { obligation: updated } = await linkObligationToRecurringTemplate(userId, deviceId, obligationId, template.id);
  return { obligation: updated, template, operation: null as unknown as SyncOperation };
}

export async function deleteFinancialObligation(
  userId: string,
  deviceId: string,
  id: string,
): Promise<{ obligation: FinancialObligation; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { obligation: FinancialObligation; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<FinancialObligationRow>(
      "SELECT * FROM financial_obligations WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!existing) throw new LocalDbError("NOT_FOUND", "obligation not found");

    await db.runAsync(
      `UPDATE financial_obligations
       SET deleted = 1, status = 'deleted', updated_at = ?, version = version + 1
       WHERE id = ? AND user_id = ?`,
      ts,
      id,
      userId,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "financial_obligations",
      recordId: id,
      operationType: "delete",
      baseVersion: existing.version,
      changedFields: [],
      payload: {},
      failureMessage: `This financial obligation "${existing.name}" could not be deleted.`,
    });

    const row = await db.getFirstAsync<FinancialObligationRow>(
      "SELECT * FROM financial_obligations WHERE id = ?",
      id,
    );
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read deleted obligation");
    result = { obligation: mapObligation(row), operation };
  });

  return result!;
}
