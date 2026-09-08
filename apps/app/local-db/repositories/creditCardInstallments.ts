import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";

export type CreditCardInstallmentInterestType = "zero_interest" | "interest_bearing";
export type CreditCardInstallmentSettlementStatus = "active" | "early_settlement_requested" | "completed";

export type CreateCreditCardInstallmentInput = {
  description: string;
  original_principal_centavos: number;
  remaining_principal_centavos: number;
  term_months: number;
  remaining_months: number;
  monthly_amortization_centavos: number;
  interest_type: CreditCardInstallmentInterestType;
  interest_rate_bps?: number;
  settlement_status: CreditCardInstallmentSettlementStatus;
};

export type CreditCardInstallment = CreateCreditCardInstallmentInput & {
  id: string;
  user_id: string;
  account_id: string;
  transaction_id: string;
  version: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type CreditCardPurchaseMetadata = {
  purchase_type: "regular" | "installment";
  installment_id: string | null;
  installment: CreditCardInstallment | null;
};

type InstallmentRow = Omit<CreditCardInstallment, "deleted"> & { deleted: number };

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new LocalDbError("VALIDATION_ERROR", `${field} must be a positive whole number.`);
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new LocalDbError("VALIDATION_ERROR", `${field} must be a non-negative whole number.`);
  }
}

export function validateCreditCardInstallment(input: CreateCreditCardInstallmentInput): void {
  if (!input.description.trim()) {
    throw new LocalDbError("VALIDATION_ERROR", "Installment description is required.");
  }
  assertPositiveInteger(input.original_principal_centavos, "Original principal");
  assertNonNegativeInteger(input.remaining_principal_centavos, "Remaining principal");
  assertPositiveInteger(input.term_months, "Term");
  assertNonNegativeInteger(input.remaining_months, "Remaining months");
  assertPositiveInteger(input.monthly_amortization_centavos, "Monthly amortization");
  if (input.remaining_principal_centavos > input.original_principal_centavos) {
    throw new LocalDbError("VALIDATION_ERROR", "Remaining principal cannot exceed the original principal.");
  }
  if (input.remaining_months > input.term_months) {
    throw new LocalDbError("VALIDATION_ERROR", "Remaining months cannot exceed the installment term.");
  }
  if (input.interest_type !== "zero_interest" && input.interest_type !== "interest_bearing") {
    throw new LocalDbError("VALIDATION_ERROR", "Choose a valid interest type.");
  }
  if (input.interest_type === "interest_bearing") {
    assertNonNegativeInteger(input.interest_rate_bps ?? -1, "Interest rate");
  }
  if (!["active", "early_settlement_requested", "completed"].includes(input.settlement_status)) {
    throw new LocalDbError("VALIDATION_ERROR", "Choose a valid settlement status.");
  }
}

function mapInstallment(row: InstallmentRow): CreditCardInstallment {
  return { ...row, deleted: row.deleted === 1 };
}

export async function listCreditCardInstallments(userId: string): Promise<CreditCardInstallment[]> {
  const db = await initDatabase();
  const rows = await db.getAllAsync<InstallmentRow>(
    `SELECT * FROM credit_card_installments
      WHERE user_id = ? AND deleted = 0 AND settlement_status != 'completed'
      ORDER BY settlement_status = 'active' DESC, created_at DESC`,
    userId,
  );
  return rows.map(mapInstallment);
}

export async function getCreditCardPurchaseMetadataForTransaction(
  userId: string,
  transactionId: string,
): Promise<CreditCardPurchaseMetadata | null> {
  const db = await initDatabase();
  const purchase = await db.getFirstAsync<{ purchase_type: "regular" | "installment"; installment_id: string | null }>(
    `SELECT purchase_type, installment_id FROM credit_card_transactions
      WHERE user_id = ? AND transaction_id = ? AND deleted = 0`,
    userId,
    transactionId,
  );
  if (!purchase) return null;
  const installment = purchase.installment_id
    ? await db.getFirstAsync<InstallmentRow>(
      `SELECT * FROM credit_card_installments
        WHERE user_id = ? AND id = ? AND transaction_id = ? AND deleted = 0`,
      userId,
      purchase.installment_id,
      transactionId,
    )
    : null;
  return {
    purchase_type: purchase.purchase_type,
    installment_id: purchase.installment_id,
    installment: installment ? mapInstallment(installment) : null,
  };
}

export async function createCreditCardInstallmentInTransaction(
  db: SQLite.SQLiteDatabase,
  userId: string,
  deviceId: string,
  accountId: string,
  transactionId: string,
  input: CreateCreditCardInstallmentInput,
  timestamp: string,
): Promise<{ installment: CreditCardInstallment; operation: SyncOperation }> {
  validateCreditCardInstallment(input);
  const id = randomUUID();
  const payload = {
    account_id: accountId,
    transaction_id: transactionId,
    ...input,
    description: input.description.trim(),
    interest_rate_bps: input.interest_type === "zero_interest" ? 0 : input.interest_rate_bps ?? 0,
  };

  await db.runAsync(
    `INSERT INTO credit_card_installments
      (id, user_id, account_id, transaction_id, description, original_principal_centavos,
       remaining_principal_centavos, term_months, remaining_months, monthly_amortization_centavos,
       interest_rate_bps, interest_type, settlement_status, version, deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
    id, userId, accountId, transactionId, payload.description, payload.original_principal_centavos,
    payload.remaining_principal_centavos, payload.term_months, payload.remaining_months,
    payload.monthly_amortization_centavos, payload.interest_rate_bps, payload.interest_type,
    payload.settlement_status, timestamp, timestamp,
  );

  const operation = await enqueueOperation(db, {
    userId,
    deviceId,
    entity: "credit_card_installments",
    recordId: id,
    operationType: "create",
    baseVersion: null,
    changedFields: Object.keys(payload),
    payload,
    failureMessage: "This installment could not be recorded.",
  });
  const row = await db.getFirstAsync<InstallmentRow>(
    "SELECT * FROM credit_card_installments WHERE id = ? AND user_id = ?",
    id,
    userId,
  );
  if (!row) throw new LocalDbError("INTERNAL_ERROR", "Failed to read recorded installment.");
  return { installment: { ...row, deleted: row.deleted === 1 }, operation };
}
