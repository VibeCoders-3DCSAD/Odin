import * as SQLite from "expo-sqlite";
import { enqueueOperation, LocalDbError } from "../../helpers";
import type { SyncOperation } from "../../types";
import { getDb, now } from "../helpers/db";
import { isDayOfMonth } from "./calendarDays";
import type { CreditCardDetailsInput } from "./financialAccountModel";

type CreditCardDetailsSyncRow = {
  account_id: string;
  user_id: string;
  issuer: string | null;
  credit_limit_centavos: number;
  available_credit_centavos: number | null;
  reconciled_available_credit_centavos: number | null;
  pre_reconciliation_available_credit_centavos: number | null;
  available_credit_reconciled_at: string | null;
  cutoff_day: number;
  statement_day: number | null;
  notes: string | null;
  billing_cycle_days: number | null;
  alert_threshold_percent: number | null;
  allows_extra_payments: number;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateCreditCardDetails(details: Partial<CreditCardDetailsInput>, required: boolean): void {
  if (required) {
    for (const field of ["creditLimitCentavos", "cutoffDay", "alertThresholdPercent"] as const) {
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

// ---------------------------------------------------------------------------
// Persistence and sync
// ---------------------------------------------------------------------------

export async function upsertCreditCardDetails(
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
       alert_threshold_percent, allows_extra_payments, version, deleted, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?, 1, 0, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        credit_limit_centavos = excluded.credit_limit_centavos,
        available_credit_centavos = excluded.available_credit_centavos,
       cutoff_day = excluded.cutoff_day,
       statement_day = excluded.statement_day,
       billing_cycle_days = excluded.billing_cycle_days,
       alert_threshold_percent = excluded.alert_threshold_percent,
       allows_extra_payments = excluded.allows_extra_payments,
       deleted = 0,
       updated_at = excluded.updated_at,
       version = credit_card_details.version + 1`,
    accountId,
    userId,
    details.creditLimitCentavos,
    availableCredit,
    details.cutoffDay,
    details.statementDay ?? null,
    details.billingCycleDays ?? null,
    details.alertThresholdPercent,
    details.allowsExtraPayments ? 1 : 0,
    ts,
    ts,
  );
}

export async function enqueueCreditCardDetailsOperation(
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
           ...(operationType === "create" ? {} : {
             available_credit_centavos: row.available_credit_centavos,
             reconciled_available_credit_centavos: row.reconciled_available_credit_centavos,
             pre_reconciliation_available_credit_centavos: row.pre_reconciliation_available_credit_centavos,
             available_credit_reconciled_at: row.available_credit_reconciled_at,
           }),
           cutoff_day: row.cutoff_day,
        statement_day: row.statement_day,
        notes: row.notes,
        billing_cycle_days: row.billing_cycle_days,
        alert_threshold_percent: row.alert_threshold_percent,
        allows_extra_payments: row.allows_extra_payments === 1,
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

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export async function reconcileCreditCardAvailableCredit(
  userId: string,
  deviceId: string,
  accountId: string,
  availableCreditCentavos: number,
): Promise<void> {
  if (!Number.isSafeInteger(availableCreditCentavos) || availableCreditCentavos < 0) {
    throw new LocalDbError("VALIDATION_ERROR", "Enter a valid available credit amount.");
  }

  const db = await getDb();
  const timestamp = now();
  await db.withTransactionAsync(async () => {
    const details = await db.getFirstAsync<{ credit_limit_centavos: number; available_credit_centavos: number | null; version: number }>(
      "SELECT credit_limit_centavos, available_credit_centavos, version FROM credit_card_details WHERE account_id = ? AND user_id = ? AND deleted = 0",
      accountId,
      userId,
    );
    if (!details) throw new LocalDbError("NOT_FOUND", "Credit-card details not found.");
    if (availableCreditCentavos > details.credit_limit_centavos) {
      throw new LocalDbError("VALIDATION_ERROR", "Available credit cannot exceed the credit limit.");
    }

    await db.runAsync(
      `UPDATE credit_card_details SET available_credit_centavos = ?, reconciled_available_credit_centavos = ?,
         pre_reconciliation_available_credit_centavos = COALESCE(available_credit_centavos, credit_limit_centavos),
         available_credit_reconciled_at = ?, version = version + 1, updated_at = ?
       WHERE account_id = ? AND user_id = ? AND deleted = 0`,
      availableCreditCentavos,
      availableCreditCentavos,
      timestamp,
      timestamp,
      accountId,
      userId,
    );
    await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "credit_card_details",
      recordId: accountId,
      operationType: "update",
      baseVersion: details.version,
      changedFields: ["available_credit_centavos", "reconciled_available_credit_centavos", "pre_reconciliation_available_credit_centavos", "available_credit_reconciled_at"],
      payload: { available_credit_centavos: availableCreditCentavos, reconciled_available_credit_centavos: availableCreditCentavos, pre_reconciliation_available_credit_centavos: details.available_credit_centavos ?? details.credit_limit_centavos, available_credit_reconciled_at: timestamp },
      failureMessage: "Your issuer-reported available credit could not be reconciled.",
    });
  });
}
