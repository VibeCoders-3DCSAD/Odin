import * as SQLite from "expo-sqlite";
import { LocalDbError } from "../../helpers";
import { validateIsoDate } from "../credit-cards/creditCardCycleDates";
import type { TransactionRow } from "./transactionRows";
import { BILLER_PAYMENT_MUTATION_PREFIX, type CreateIncomeInput, type CreateTransferInput, type ExpenseInsertInput, type UpdateTransactionInput } from "./transactionTypes";

export async function verifyAccountOwnership(
  db: SQLite.SQLiteDatabase,
  userId: string,
  accountId: string,
  label: string,
): Promise<void> {
  // ponytail: query financial_accounts inline, skip full repo import
  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM financial_accounts WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    accountId,
  );
  if (!row) {
    throw new LocalDbError("VALIDATION_ERROR", `${label} not found or inaccessible`);
  }
}

async function verifyOwnedAccount(
  db: SQLite.SQLiteDatabase,
  userId: string,
  accountId: string,
  label: string,
): Promise<void> {
  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM financial_accounts WHERE user_id = ? AND id = ?",
    userId,
    accountId,
  );
  if (!row) {
    throw new LocalDbError("VALIDATION_ERROR", `${label} not found or inaccessible`);
  }
}

export async function verifyExpenseAccountCanBeUsed(
  db: SQLite.SQLiteDatabase,
  userId: string,
  accountId: string,
): Promise<boolean> {
  const card = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM financial_accounts WHERE user_id = ? AND id = ? AND kind = 'credit_card' AND deleted = 0",
    userId,
    accountId,
  );
  return Boolean(card);
}

async function verifySubcategoryOwnership(
  db: SQLite.SQLiteDatabase,
  userId: string,
  subcategoryId: string,
  kind?: string,
): Promise<void> {
  // ponytail: query subcategories inline, skip full repo import
  let sql = "SELECT id FROM subcategories WHERE user_id = ? AND id = ? AND deleted = 0 AND is_active = 1";
  const params: SQLite.SQLiteBindValue[] = [userId, subcategoryId];
  if (kind) {
    sql += " AND kind = ?";
    params.push(kind);
  }
  const row = await db.getFirstAsync<{ id: string }>(sql, ...params);
  if (!row) {
    const msg = kind
      ? `subcategory not found or not a ${kind} subcategory`
      : "subcategory not found or inaccessible";
    throw new LocalDbError("VALIDATION_ERROR", msg);
  }
}

export function validateAmount(amount: number): void {
  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
    throw new LocalDbError("VALIDATION_ERROR", "amount_centavos must be a positive number");
  }
  if (!Number.isInteger(amount)) {
    throw new LocalDbError("VALIDATION_ERROR", "amount_centavos must be an integer");
  }
}

export async function validateIncomeShape(
  db: SQLite.SQLiteDatabase,
  userId: string,
  input: CreateIncomeInput,
): Promise<void> {
  validateAmount(input.amount_centavos);
  if (!input.destination_account_id) {
    throw new LocalDbError("VALIDATION_ERROR", "destination_account_id is required for income");
  }
  if (!input.subcategory_id) {
    throw new LocalDbError("VALIDATION_ERROR", "subcategory_id is required for income");
  }
  if (!input.transaction_date) {
    throw new LocalDbError("VALIDATION_ERROR", "transaction_date is required");
  }
  if ((input as Record<string, unknown>).source_account_id != null) {
    throw new LocalDbError("VALIDATION_ERROR", "source_account_id must not be set for income");
  }
  await verifyAccountOwnership(db, userId, input.destination_account_id, "destination account");
  await verifySubcategoryOwnership(db, userId, input.subcategory_id, "income");
}

export async function validateExpenseShape(
  db: SQLite.SQLiteDatabase,
  userId: string,
  input: ExpenseInsertInput,
): Promise<void> {
  validateAmount(input.amount_centavos);
  if (!input.source_account_id) {
    throw new LocalDbError("VALIDATION_ERROR", "source_account_id is required for expense");
  }
  if (!input.subcategory_id && !input.client_mutation_id?.startsWith(BILLER_PAYMENT_MUTATION_PREFIX)) {
    throw new LocalDbError("VALIDATION_ERROR", "subcategory_id is required for expense");
  }
  if (!input.transaction_date) {
    throw new LocalDbError("VALIDATION_ERROR", "transaction_date is required");
  }
  if ((input as Record<string, unknown>).destination_account_id != null) {
    throw new LocalDbError("VALIDATION_ERROR", "destination_account_id must not be set for expense");
  }
  await verifyAccountOwnership(db, userId, input.source_account_id, "source account");
  const isCreditCard = await verifyExpenseAccountCanBeUsed(db, userId, input.source_account_id);
  if (!isCreditCard && input.credit_card_posting_date != null) {
    throw new LocalDbError("VALIDATION_ERROR", "credit_card_posting_date is only valid for credit-card expenses");
  }
  if (!isCreditCard && input.installment) {
    throw new LocalDbError("VALIDATION_ERROR", "Installments can only be recorded on a credit card.");
  }
  if (input.installment && input.installment.original_principal_centavos !== input.amount_centavos) {
    throw new LocalDbError("VALIDATION_ERROR", "Installment original principal must match the transaction amount.");
  }
  if (input.credit_card_posting_date != null) validateIsoDate(input.credit_card_posting_date, "credit_card_posting_date");
  if (input.subcategory_id) await verifySubcategoryOwnership(db, userId, input.subcategory_id, "expense");
}

export async function validateTransferShape(
  db: SQLite.SQLiteDatabase,
  userId: string,
  input: CreateTransferInput,
): Promise<void> {
  validateAmount(input.amount_centavos);
  if (!input.source_account_id) {
    throw new LocalDbError("VALIDATION_ERROR", "source_account_id is required for transfer");
  }
  if (!input.destination_account_id) {
    throw new LocalDbError("VALIDATION_ERROR", "destination_account_id is required for transfer");
  }
  if (input.source_account_id === input.destination_account_id) {
    throw new LocalDbError("VALIDATION_ERROR", "source and destination accounts must differ");
  }
  if (!input.transaction_date) {
    throw new LocalDbError("VALIDATION_ERROR", "transaction_date is required");
  }
  if ("subcategory_id" in input && (input as Record<string, unknown>).subcategory_id != null) {
    throw new LocalDbError("VALIDATION_ERROR", "subcategory_id must not be set for transfer");
  }
  await verifyAccountOwnership(db, userId, input.source_account_id, "source account");
  await verifyAccountOwnership(db, userId, input.destination_account_id, "destination account");
}

export async function validateUpdatedShape(
  db: SQLite.SQLiteDatabase,
  userId: string,
  current: TransactionRow,
  input: UpdateTransactionInput,
): Promise<{
  transaction_type: string;
  source_account_id: string | null;
  destination_account_id: string | null;
  destination_savings_goal_id?: string | null;
  source_savings_goal_id?: string | null;
  subcategory_id: string | null;
}> {
  const transactionType = current.transaction_type;
  const sourceId = input.source_account_id ?? current.source_account_id;
  const destId = input.destination_account_id ?? current.destination_account_id;
  const subId = input.subcategory_id ?? current.subcategory_id;

  if (input.amount_centavos != null) validateAmount(input.amount_centavos);

  if (sourceId != null) {
    await (input.source_account_id === undefined
      ? verifyOwnedAccount(db, userId, sourceId, "source account")
      : verifyAccountOwnership(db, userId, sourceId, "source account"));
  }
  if (destId != null) {
    await (input.destination_account_id === undefined
      ? verifyOwnedAccount(db, userId, destId, "destination account")
      : verifyAccountOwnership(db, userId, destId, "destination account"));
  }
  if (subId != null) {
    const subKind = transactionType === "income" ? "income" : "expense";
    await verifySubcategoryOwnership(db, userId, subId, subKind);
  }

  if (transactionType === "income") {
    if (!destId) throw new LocalDbError("VALIDATION_ERROR", "destination_account_id is required for income");
    if (sourceId != null) throw new LocalDbError("VALIDATION_ERROR", "source_account_id must be null for income");
    if (!subId) throw new LocalDbError("VALIDATION_ERROR", "subcategory_id is required for income");
  } else if (transactionType === "expense") {
    if (!sourceId) throw new LocalDbError("VALIDATION_ERROR", "source_account_id is required for expense");
    if (destId != null) throw new LocalDbError("VALIDATION_ERROR", "destination_account_id must be null for expense");
    if (!subId) throw new LocalDbError("VALIDATION_ERROR", "subcategory_id is required for expense");
    await verifyExpenseAccountCanBeUsed(db, userId, sourceId);
    if (input.credit_card_posting_date != null) validateIsoDate(input.credit_card_posting_date, "credit_card_posting_date");
  } else if (transactionType === "transfer") {
    if (!sourceId || !destId) throw new LocalDbError("VALIDATION_ERROR", "both accounts are required for transfer");
    if (sourceId === destId && !current.destination_savings_goal_id) throw new LocalDbError("VALIDATION_ERROR", "source and destination accounts must differ");
    if (subId != null) throw new LocalDbError("VALIDATION_ERROR", "subcategory_id must be null for transfer");
  }

  return {
    transaction_type: transactionType,
    source_account_id: sourceId,
    destination_account_id: destId,
    subcategory_id: subId,
  };
}
