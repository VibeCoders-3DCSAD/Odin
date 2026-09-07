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
  cc_credit_limit_centavos: number | null;
  cc_available_credit_centavos: number | null;
  cc_issuer: string | null;
  cc_notes: string | null;
  cc_billing_cycle_days: number | null;
  cc_cutoff_day: number | null;
  cc_statement_day: number | null;
  cc_alert_threshold_percent: number | null;
};

type CreditCardDetailsSyncRow = {
  account_id: string;
  user_id: string;
  issuer: string | null;
  credit_limit_centavos: number;
  available_credit_centavos: number | null;
  cutoff_day: number;
  statement_day: number | null;
  notes: string | null;
  billing_cycle_days: number | null;
  alert_threshold_percent: number | null;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
};

type IncomeSourceRow = {
  id: string;
  user_id: string;
  name: string;
  income_type: string;
  frequency: string;
  recurring_template_id: string | null;
  destination_account_id: string | null;
  subcategory_id: string | null;
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
  | "other";

export type FinancialAccountStatus = "active" | "archived";

export type FinancialAccount = {
  id: string;
  name: string;
  kind: FinancialAccountKind;
  status: FinancialAccountStatus;
  openingBalanceCentavos: number;
  currentBalanceCentavos: number;
  includeInDashboardBalance: boolean;
  institutionName: string | null;
  openedOn: string | null;
  archivedAt: string | null;
  sortOrder: number;
  creditCardDetails: CreditCardDetails | null;
};

export type CreditCardDetails = {
  creditLimitCentavos: number;
  availableCreditCentavos: number | null;
  issuer: string | null;
  notes: string | null;
  billingCycleDays: number | null;
  cutoffDay: number;
  statementDay: number | null;
  alertThresholdPercent: number | null;
};

export type CreditCardDetailsInput = {
  creditLimitCentavos: number;
  billingCycleDays: number;
  cutoffDay: number;
  statementDay?: number | null;
  alertThresholdPercent: number;
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
  recurringTemplateId: string | null;
  destinationAccountId: string | null;
  subcategoryId: string | null;
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
  includeInDashboardBalance?: boolean;
  institutionName?: string | null;
  openedOn?: string | null;
  sortOrder?: number;
  creditCardDetails?: CreditCardDetailsInput;
};

export type UpdateFinancialAccountInput = {
  name?: string;
  kind?: FinancialAccountKind;
  status?: FinancialAccountStatus;
  openingBalanceCentavos?: number;
  currentBalanceCentavos?: number;
  includeInDashboardBalance?: boolean;
  institutionName?: string | null;
  openedOn?: string | null;
  archivedAt?: string | null;
  sortOrder?: number;
  creditCardDetails?: CreditCardDetailsInput;
};

export type CreateIncomeSourceInput = {
  name: string;
  incomeType: IncomeType;
  frequency: IncomeFrequency;
  destinationAccountId: string;
  subcategoryId: string;
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
  recurringTemplateId?: string | null;
  destinationAccountId?: string | null;
  subcategoryId?: string | null;
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
    includeInDashboardBalance: row.include_in_dashboard_balance === 1,
    institutionName: row.institution_name,
    openedOn: row.opened_on,
    archivedAt: row.archived_at,
    sortOrder: row.sort_order,
    creditCardDetails:
      row.kind === "credit_card" && row.cc_credit_limit_centavos != null
        ? {
            creditLimitCentavos: row.cc_credit_limit_centavos,
            availableCreditCentavos: row.cc_available_credit_centavos,
            issuer: row.cc_issuer,
            notes: row.cc_notes,
            billingCycleDays: row.cc_billing_cycle_days,
            cutoffDay: row.cc_cutoff_day ?? 0,
            statementDay: row.cc_statement_day,
            alertThresholdPercent: row.cc_alert_threshold_percent,
          }
        : null,
  };
}

function mapIncomeSource(row: IncomeSourceRow): IncomeSource {
  return {
    id: row.id,
    name: row.name,
    incomeType: row.income_type as IncomeType,
    frequency: row.frequency as IncomeFrequency,
    recurringTemplateId: row.recurring_template_id,
    destinationAccountId: row.destination_account_id,
    subcategoryId: row.subcategory_id,
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

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getIncomeRecurringFrequency(frequency: IncomeFrequency): import("./recurringTransactions").CreateRecurringInput["frequency"] {
  return frequency === "irregular" ? "custom" : frequency;
}

function resolveIncomeRecurringAmount(input: {
  expectedAmountCentavos?: number | null;
  minAmountCentavos?: number | null;
  maxAmountCentavos?: number | null;
}): number {
  const amount = [
    input.expectedAmountCentavos,
    input.maxAmountCentavos,
    input.minAmountCentavos,
  ].find((value): value is number => value != null && value > 0);
  if (amount === undefined) {
    throw new LocalDbError("VALIDATION_ERROR", "income sources need an amount to create a linked recurring transaction");
  }
  return amount;
}

async function assertAccessibleIncomeDestinationAndCategory(
  db: SQLite.SQLiteDatabase,
  userId: string,
  destinationAccountId: string,
  subcategoryId: string,
): Promise<void> {
  const account = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM financial_accounts WHERE user_id = ? AND id = ? AND deleted = 0 AND status = 'active'",
    userId,
    destinationAccountId,
  );
  if (!account) {
    throw new LocalDbError("VALIDATION_ERROR", "destinationAccountId does not reference an accessible active account");
  }

  const subcategory = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM subcategories WHERE user_id = ? AND id = ? AND kind = 'income' AND deleted = 0 AND is_active = 1",
    userId,
    subcategoryId,
  );
  if (!subcategory) {
    throw new LocalDbError("VALIDATION_ERROR", "subcategoryId does not reference an accessible active income subcategory");
  }
}

async function syncIncomeSourceRecurringTemplate(
  db: SQLite.SQLiteDatabase,
  userId: string,
  deviceId: string,
  source: {
    id: string;
    recurringTemplateId: string | null;
    name: string;
    frequency: IncomeFrequency;
    destinationAccountId: string;
    subcategoryId: string;
    expectedAmountCentavos: number | null;
    minAmountCentavos: number | null;
    maxAmountCentavos: number | null;
    paydayDayOfMonth: number | null;
    paydaySecondDayOfMonth: number | null;
    paydayDayOfWeek: number | null;
    nextExpectedDate: string | null;
    notes: string | null;
  },
): Promise<string> {
  const { createRecurringTemplate, updateRecurringTemplate } = await import("./recurringTransactions");

  const recurringInput = {
    transaction_type: "income" as const,
    name: source.name,
    amount_centavos: resolveIncomeRecurringAmount(source),
    frequency: getIncomeRecurringFrequency(source.frequency),
    day_of_month: source.paydayDayOfMonth ?? undefined,
    second_day_of_month: source.paydaySecondDayOfMonth ?? undefined,
    day_of_week: source.paydayDayOfWeek ?? undefined,
    starts_on: source.nextExpectedDate ?? todayDate(),
    subcategory_id: source.subcategoryId,
    destination_account_id: source.destinationAccountId,
    notes: source.notes ?? undefined,
  };

  if (source.recurringTemplateId) {
    await updateRecurringTemplate(userId, deviceId, source.recurringTemplateId, recurringInput, db);
    return source.recurringTemplateId;
  }

  const { template } = await createRecurringTemplate(userId, deviceId, recurringInput, db);
  return template.id;
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

function isDayOfMonth(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 31;
}

function validateCreditCardDetails(details: Partial<CreditCardDetailsInput>, required: boolean): void {
  if (required) {
    for (const field of ["creditLimitCentavos", "billingCycleDays", "cutoffDay", "alertThresholdPercent"] as const) {
      const value = details[field];
      if (value === undefined || value === null) {
        throw new LocalDbError("VALIDATION_ERROR", `${field} is required for credit card accounts`);
      }
    }
  }
  const limit = details.creditLimitCentavos;
  if (limit != null && (typeof limit !== "number" || !Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0)) {
    throw new LocalDbError("VALIDATION_ERROR", "creditLimitCentavos must be a positive integer");
  }
  const cycle = details.billingCycleDays;
  if (cycle != null && !Number.isInteger(cycle)) {
    throw new LocalDbError("VALIDATION_ERROR", "billingCycleDays must be an integer");
  }
  if (cycle != null && (cycle < 28 || cycle > 31)) {
    throw new LocalDbError("VALIDATION_ERROR", "billingCycleDays must be between 28 and 31");
  }
  if (details.cutoffDay != null && !isDayOfMonth(details.cutoffDay)) {
    throw new LocalDbError("VALIDATION_ERROR", "cutoffDay must be an integer between 1 and 31");
  }
  if (details.statementDay != null && !isDayOfMonth(details.statementDay)) {
    throw new LocalDbError("VALIDATION_ERROR", "statementDay must be an integer between 1 and 31");
  }
  const threshold = details.alertThresholdPercent;
  if (threshold != null && (threshold < 0 || threshold > 100)) {
    throw new LocalDbError("VALIDATION_ERROR", "alertThresholdPercent must be between 0 and 100");
  }
}

async function upsertCreditCardDetails(
  db: SQLite.SQLiteDatabase,
  userId: string,
  accountId: string,
  details: CreditCardDetailsInput,
  ts: string,
): Promise<void> {
  validateCreditCardDetails(details, true);
  const usage = await db.getFirstAsync<{ outstanding_centavos: number | null }>(
    `SELECT SUM(t.amount_centavos - cct.applied_credit_centavos) AS outstanding_centavos
       FROM credit_card_transactions cct
       JOIN transactions t ON t.id = cct.transaction_id AND t.user_id = cct.user_id
      WHERE cct.user_id = ? AND cct.account_id = ? AND cct.deleted = 0 AND t.deleted = 0`,
    userId,
    accountId,
  );
  const availableCredit = details.creditLimitCentavos - (usage?.outstanding_centavos ?? 0);
  await db.runAsync(
    `INSERT INTO credit_card_details
      (account_id, user_id, issuer, credit_limit_centavos, available_credit_centavos,
       cutoff_day, statement_day, notes, billing_cycle_days,
       alert_threshold_percent, version, deleted, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, 1, 0, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        credit_limit_centavos = excluded.credit_limit_centavos,
        available_credit_centavos = excluded.available_credit_centavos,
       cutoff_day = excluded.cutoff_day,
       statement_day = excluded.statement_day,
       billing_cycle_days = excluded.billing_cycle_days,
       alert_threshold_percent = excluded.alert_threshold_percent,
       deleted = 0,
       updated_at = excluded.updated_at,
       version = credit_card_details.version + 1`,
    accountId,
    userId,
    details.creditLimitCentavos,
    availableCredit,
    details.cutoffDay,
    details.statementDay ?? null,
    details.billingCycleDays,
    details.alertThresholdPercent,
    ts,
    ts,
  );
}

async function enqueueCreditCardDetailsOperation(
  db: SQLite.SQLiteDatabase,
  userId: string,
  deviceId: string,
  accountId: string,
  operationType: "create" | "update" | "delete",
  baseVersion: number | null,
): Promise<SyncOperation | null> {
  const row = await db.getFirstAsync<CreditCardDetailsSyncRow>(
    "SELECT * FROM credit_card_details WHERE account_id = ? AND user_id = ?",
    accountId,
    userId,
  );
  if (!row) return null;
    const payload = operationType === "delete"
      ? { account_id: accountId }
      : {
          account_id: accountId,
          issuer: row.issuer,
          credit_limit_centavos: row.credit_limit_centavos,
          cutoff_day: row.cutoff_day,
        statement_day: row.statement_day,
        notes: row.notes,
        billing_cycle_days: row.billing_cycle_days,
        alert_threshold_percent: row.alert_threshold_percent,
        };
  return enqueueOperation(db, {
    userId,
    deviceId,
    entity: "credit_card_details",
    recordId: accountId,
    operationType,
    baseVersion,
    changedFields: operationType === "delete" ? [] : Object.keys(payload),
    payload,
    failureMessage: "This credit-card information could not be synchronized.",
  });
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
    `SELECT fa.*, cc.credit_limit_centavos AS cc_credit_limit_centavos,
             cc.available_credit_centavos AS cc_available_credit_centavos,
             cc.issuer AS cc_issuer,
             cc.notes AS cc_notes,
             cc.billing_cycle_days AS cc_billing_cycle_days,
            cc.cutoff_day AS cc_cutoff_day,
            cc.statement_day AS cc_statement_day,
            cc.alert_threshold_percent AS cc_alert_threshold_percent
     FROM financial_accounts fa
     LEFT JOIN credit_card_details cc
       ON cc.account_id = fa.id AND cc.user_id = fa.user_id AND cc.deleted = 0
     WHERE fa.user_id = ? AND fa.deleted = 0
     ORDER BY fa.sort_order`,
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
    `SELECT fa.*, cc.credit_limit_centavos AS cc_credit_limit_centavos,
             cc.available_credit_centavos AS cc_available_credit_centavos,
             cc.issuer AS cc_issuer,
             cc.notes AS cc_notes,
             cc.billing_cycle_days AS cc_billing_cycle_days,
            cc.cutoff_day AS cc_cutoff_day,
            cc.statement_day AS cc_statement_day,
            cc.alert_threshold_percent AS cc_alert_threshold_percent
     FROM financial_accounts fa
     LEFT JOIN credit_card_details cc
       ON cc.account_id = fa.id AND cc.user_id = fa.user_id AND cc.deleted = 0
     WHERE fa.user_id = ? AND fa.id = ? AND fa.deleted = 0`,
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
  if (input.kind === "credit_card") {
    validateCreditCardDetails(input.creditCardDetails ?? {}, true);
  }
  if (input.openingBalanceCentavos != null && (typeof input.openingBalanceCentavos !== "number" || !Number.isFinite(input.openingBalanceCentavos) || !Number.isInteger(input.openingBalanceCentavos))) {
    throw new LocalDbError("VALIDATION_ERROR", "openingBalanceCentavos must be a finite integer");
  }

  const db = await getDb();
  const id = randomUUID();
  const ts = now();
  const payload: Record<string, unknown> = {
    name: input.name,
    kind: input.kind,
    opening_balance_centavos: input.openingBalanceCentavos ?? 0,
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
         include_in_dashboard_balance, institution_name, opened_on,
         sort_order, metadata, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, '{}', 1, 0, ?, ?)`,
      id,
      userId,
      input.name,
      input.kind,
      input.openingBalanceCentavos ?? 0,
      input.openingBalanceCentavos ?? 0,
      boolToInt(input.includeInDashboardBalance ?? true),
      input.institutionName ?? null,
      input.openedOn ?? null,
      input.sortOrder ?? 0,
      ts,
      ts,
    );

    if (input.kind === "credit_card") {
      await upsertCreditCardDetails(db, userId, id, input.creditCardDetails!, ts);
    }

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

    if (input.kind === "credit_card") {
      await enqueueCreditCardDetailsOperation(db, userId, deviceId, id, "create", null);
    }

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
  if (input.kind && !VALID_ACCOUNT_KINDS.includes(input.kind)) {
    throw new LocalDbError("VALIDATION_ERROR", `kind must be one of: ${VALID_ACCOUNT_KINDS.join(", ")}`);
  }
  if (input.kind === "credit_card" && !input.creditCardDetails) {
    throw new LocalDbError("VALIDATION_ERROR", "creditCardDetails is required when switching to a credit card account");
  }
  if (input.creditCardDetails) {
    validateCreditCardDetails(input.creditCardDetails, true);
  }

  const db = await getDb();
  const ts = now();
  const changedFields: string[] = [];
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) { changedFields.push("name"); payload.name = input.name; }
  if (input.kind !== undefined) { changedFields.push("kind"); payload.kind = input.kind; }
  if (input.status !== undefined) { changedFields.push("status"); payload.status = input.status; }
  if (input.openingBalanceCentavos !== undefined) { changedFields.push("opening_balance_centavos"); payload.opening_balance_centavos = input.openingBalanceCentavos; }
  if (input.currentBalanceCentavos !== undefined) { changedFields.push("current_balance_centavos"); payload.current_balance_centavos = input.currentBalanceCentavos; }
  if (input.includeInDashboardBalance !== undefined) { changedFields.push("include_in_dashboard_balance"); payload.include_in_dashboard_balance = input.includeInDashboardBalance; }
  if (input.institutionName !== undefined) { changedFields.push("institution_name"); payload.institution_name = input.institutionName; }
  if (input.openedOn !== undefined) { changedFields.push("opened_on"); payload.opened_on = input.openedOn; }
  if (input.archivedAt !== undefined) { changedFields.push("archived_at"); payload.archived_at = input.archivedAt; }
  if (input.sortOrder !== undefined) { changedFields.push("sort_order"); payload.sort_order = input.sortOrder; }

    if (changedFields.length === 0 && !input.creditCardDetails) {
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
    if (input.kind === existing.kind) {
      changedFields.splice(changedFields.indexOf("kind"), 1);
      delete payload.kind;
    }
    if (changedFields.length === 0 && !input.creditCardDetails) {
      result = { account: mapAccount(existing), operation: null as unknown as SyncOperation };
      return;
    }
    const existingCardDetails = input.creditCardDetails
      ? await db.getFirstAsync<{ version: number }>(
          "SELECT version FROM credit_card_details WHERE account_id = ? AND user_id = ? AND deleted = 0",
          id,
          userId,
        )
      : null;

    const setClauses: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];

    if (input.name !== undefined) { setClauses.push("name = ?"); params.push(input.name); }
    if (input.kind !== undefined) { setClauses.push("kind = ?"); params.push(input.kind); }
    if (input.status !== undefined) { setClauses.push("status = ?"); params.push(input.status); }
    if (input.openingBalanceCentavos !== undefined) { setClauses.push("opening_balance_centavos = ?"); params.push(input.openingBalanceCentavos); }
    if (input.currentBalanceCentavos !== undefined) { setClauses.push("current_balance_centavos = ?"); params.push(input.currentBalanceCentavos); }
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

    const effectiveKind = input.kind ?? existing.kind;
    if (effectiveKind === "credit_card" && input.creditCardDetails) {
      await upsertCreditCardDetails(db, userId, id, input.creditCardDetails, ts);
      await enqueueCreditCardDetailsOperation(db, userId, deviceId, id, existingCardDetails ? "update" : "create", existingCardDetails?.version ?? null);
    } else if (effectiveKind !== "credit_card") {
      await db.runAsync(
        "UPDATE credit_card_details SET deleted = 1, updated_at = ?, version = version + 1 WHERE account_id = ? AND user_id = ? AND deleted = 0",
        ts,
        id,
        userId,
      );
    }

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

    await db.runAsync(
      "UPDATE credit_card_details SET deleted = 1, updated_at = ?, version = version + 1 WHERE account_id = ? AND user_id = ? AND deleted = 0",
      ts,
      id,
      userId,
    );
    if (existing.kind === "credit_card") {
      await enqueueCreditCardDetailsOperation(db, userId, deviceId, id, "delete", null);
    }

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
  if (!input.name || !input.incomeType || !input.frequency || !input.destinationAccountId || !input.subcategoryId) {
    throw new LocalDbError("VALIDATION_ERROR", "name, incomeType, frequency, destinationAccountId, and subcategoryId are required");
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
  resolveIncomeRecurringAmount(input);
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
  await assertAccessibleIncomeDestinationAndCategory(db, userId, input.destinationAccountId, input.subcategoryId);
  const payload: Record<string, unknown> = {
    name: input.name,
    income_type: input.incomeType,
    frequency: input.frequency,
    destination_account_id: input.destinationAccountId,
    subcategory_id: input.subcategoryId,
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
    const recurringTemplateId = await syncIncomeSourceRecurringTemplate(db, userId, deviceId, {
      id,
      recurringTemplateId: null,
      name: input.name,
      frequency: input.frequency,
      destinationAccountId: input.destinationAccountId,
      subcategoryId: input.subcategoryId,
      expectedAmountCentavos: input.expectedAmountCentavos ?? null,
      minAmountCentavos: input.minAmountCentavos ?? null,
      maxAmountCentavos: input.maxAmountCentavos ?? null,
      paydayDayOfMonth: input.paydayDayOfMonth ?? null,
      paydaySecondDayOfMonth: input.paydaySecondDayOfMonth ?? null,
      paydayDayOfWeek: input.paydayDayOfWeek ?? null,
      nextExpectedDate: input.nextExpectedDate ?? null,
      notes: input.notes ?? null,
    });

    payload.recurring_template_id = recurringTemplateId;
    await db.runAsync(
      `INSERT INTO income_sources
        (id, user_id, recurring_template_id, destination_account_id, subcategory_id, name, income_type, frequency, expected_amount_centavos, min_amount_centavos,
          max_amount_centavos, payday_day_of_month, payday_second_day_of_month, payday_day_of_week,
          next_expected_date, estimated_interval_days, payday_second_day_of_week, is_active, notes, metadata, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 1, 0, ?, ?)`,
      id,
      userId,
      recurringTemplateId,
      input.destinationAccountId,
      input.subcategoryId,
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
  if (input.recurringTemplateId !== undefined) { changedFields.push("recurring_template_id"); payload.recurring_template_id = input.recurringTemplateId; }
  if (input.destinationAccountId !== undefined) { changedFields.push("destination_account_id"); payload.destination_account_id = input.destinationAccountId; }
  if (input.subcategoryId !== undefined) { changedFields.push("subcategory_id"); payload.subcategory_id = input.subcategoryId; }
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
    const effectiveDestinationAccountId = input.destinationAccountId !== undefined ? input.destinationAccountId : existing.destination_account_id;
    const effectiveSubcategoryId = input.subcategoryId !== undefined ? input.subcategoryId : existing.subcategory_id;
    if (effectiveMin !== null && effectiveMax !== null && effectiveMin! > effectiveMax!) {
      throw new LocalDbError("VALIDATION_ERROR", "minAmountCentavos must be <= maxAmountCentavos");
    }
    if (!effectiveDestinationAccountId || !effectiveSubcategoryId) {
      throw new LocalDbError("VALIDATION_ERROR", "destinationAccountId and subcategoryId are required");
    }
    await assertAccessibleIncomeDestinationAndCategory(db, userId, effectiveDestinationAccountId, effectiveSubcategoryId);

    const recurringTemplateId = await syncIncomeSourceRecurringTemplate(db, userId, deviceId, {
      id,
      recurringTemplateId: existing.recurring_template_id,
      name: input.name ?? existing.name,
      frequency: (input.frequency ?? existing.frequency) as IncomeFrequency,
      destinationAccountId: effectiveDestinationAccountId,
      subcategoryId: effectiveSubcategoryId,
      expectedAmountCentavos: input.expectedAmountCentavos !== undefined ? input.expectedAmountCentavos : existing.expected_amount_centavos,
      minAmountCentavos: input.minAmountCentavos !== undefined ? input.minAmountCentavos : existing.min_amount_centavos,
      maxAmountCentavos: input.maxAmountCentavos !== undefined ? input.maxAmountCentavos : existing.max_amount_centavos,
      paydayDayOfMonth: input.paydayDayOfMonth !== undefined ? input.paydayDayOfMonth : existing.payday_day_of_month,
      paydaySecondDayOfMonth: input.paydaySecondDayOfMonth !== undefined ? input.paydaySecondDayOfMonth : existing.payday_second_day_of_month,
      paydayDayOfWeek: input.paydayDayOfWeek !== undefined ? input.paydayDayOfWeek : existing.payday_day_of_week,
      nextExpectedDate: input.nextExpectedDate !== undefined ? input.nextExpectedDate : existing.next_expected_date,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    });
    if (existing.recurring_template_id !== recurringTemplateId) {
      changedFields.push("recurring_template_id");
      payload.recurring_template_id = recurringTemplateId;
    }

    const setClauses: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];

    if (input.name !== undefined) { setClauses.push("name = ?"); params.push(input.name); }
    if (input.incomeType !== undefined) { setClauses.push("income_type = ?"); params.push(input.incomeType); }
    if (input.frequency !== undefined) { setClauses.push("frequency = ?"); params.push(input.frequency); }
    if (input.destinationAccountId !== undefined) { setClauses.push("destination_account_id = ?"); params.push(input.destinationAccountId); }
    if (input.subcategoryId !== undefined) { setClauses.push("subcategory_id = ?"); params.push(input.subcategoryId); }
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
    setClauses.push("recurring_template_id = ?"); params.push(recurringTemplateId);

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

    if (existing.recurring_template_id) {
      const { deleteRecurringTemplate } = await import("./recurringTransactions");
      await deleteRecurringTemplate(userId, deviceId, existing.recurring_template_id, db);
    }

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
    secondDayOfMonth?: number | null;
    dayOfWeek?: number | null;
    startDate?: string;
  },
): Promise<{ obligation: FinancialObligation; template: import("./recurringTransactions").RecurringTemplate }> {
  const { getRecurringTemplate, createRecurringTemplate } = await import("./recurringTransactions");

  const obligation = await getFinancialObligation(userId, obligationId);
  if (!obligation) throw new LocalDbError("NOT_FOUND", "obligation not found");
  if (obligation.recurringTemplateId) throw new LocalDbError("VALIDATION_ERROR", "obligation already linked to a recurring template");

  let freq = overrides?.frequency ?? obligation.frequency;
  let intervalCount = 1;
  let dayOfMonth = overrides?.dayOfMonth !== undefined ? overrides.dayOfMonth : (obligation.dueDayOfMonth ?? undefined);
  let secondDayOfMonth = overrides?.secondDayOfMonth !== undefined ? overrides.secondDayOfMonth : (obligation.dueSecondDayOfMonth ?? undefined);
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
  return { obligation: updated, template };
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
