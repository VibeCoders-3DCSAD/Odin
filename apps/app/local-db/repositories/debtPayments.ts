import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import { randomUUID } from "../uuid";
import { createExpenseInTransaction, deleteTransaction, updateTransaction, type CreateExpenseInput } from "./ledger";

export type DebtPayment = {
  id: string; debt_account_id: string; transaction_id: string; payment_date: string;
  amount_centavos: number; notes: string | null; version: number;
};

export type DebtPaymentContext = { paymentId: string; debtAccountId: string };

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function getDb() { dbPromise ??= initDatabase(); return dbPromise; }

export async function listDebtPayments(userId: string, debtAccountId: string): Promise<DebtPayment[]> {
  const db = await getDb();
  return db.getAllAsync<DebtPayment>("SELECT id, debt_account_id, transaction_id, payment_date, amount_centavos, notes, version FROM debt_payments WHERE user_id = ? AND debt_account_id = ? AND deleted = 0 ORDER BY payment_date DESC, created_at DESC", userId, debtAccountId);
}

export async function createTransactionDebtPayment(userId: string, deviceId: string, input: Pick<CreateExpenseInput, "amount_centavos" | "source_account_id" | "subcategory_id" | "transaction_date" | "merchant_name" | "notes"> & { debt_account_id: string }): Promise<void> {
  if (!Number.isSafeInteger(input.amount_centavos) || input.amount_centavos <= 0) throw new LocalDbError("VALIDATION_ERROR", "Payment amount must be a positive whole number.");
  const db = await getDb(); const id = randomUUID(); const ts = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const debt = await db.getFirstAsync<{ current_balance_centavos: number; version: number }>("SELECT current_balance_centavos, version FROM debt_accounts WHERE id = ? AND user_id = ? AND status = 'active' AND deleted = 0", input.debt_account_id, userId);
    if (!debt) throw new LocalDbError("NOT_FOUND", "Debt not found.");
    if (input.amount_centavos > debt.current_balance_centavos) throw new LocalDbError("VALIDATION_ERROR", "Payment amount cannot exceed the current debt balance.");
    const { debt_account_id: _debtAccountId, ...expenseInput } = input;
    const { transaction } = await createExpenseInTransaction(db, userId, deviceId, { ...expenseInput, client_mutation_id: `debt-payment:${id}` });
    await db.runAsync("INSERT INTO debt_payments (id, debt_account_id, user_id, transaction_id, source, payment_date, amount_centavos, principal_centavos, interest_centavos, notes, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, 'transaction', ?, ?, ?, 0, ?, 1, 0, ?, ?)", id, input.debt_account_id, userId, transaction.id, input.transaction_date, input.amount_centavos, input.amount_centavos, input.notes ?? null, ts, ts);
    await db.runAsync("UPDATE debt_accounts SET current_balance_centavos = current_balance_centavos - ?, status = CASE WHEN current_balance_centavos = ? THEN 'paid_off' ELSE status END, paid_off_at = CASE WHEN current_balance_centavos = ? THEN COALESCE(paid_off_at, ?) ELSE paid_off_at END, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", input.amount_centavos, input.amount_centavos, input.amount_centavos, ts, ts, input.debt_account_id, userId);
    await enqueueOperation(db, { userId, deviceId, entity: "debt_payments", recordId: id, operationType: "create", baseVersion: null, changedFields: ["debt_account_id", "transaction_id", "source", "payment_date", "amount_centavos", "principal_centavos", "interest_centavos", "notes"], payload: { debt_account_id: input.debt_account_id, transaction_id: transaction.id, source: "transaction", payment_date: input.transaction_date, amount_centavos: input.amount_centavos, principal_centavos: input.amount_centavos, interest_centavos: 0, notes: input.notes ?? null, linked_transaction_type: "expense", linked_source_account_id: input.source_account_id, linked_subcategory_id: input.subcategory_id }, failureMessage: "This debt payment could not be recorded." });
  });
}

export async function deleteTransactionDebtPayment(userId: string, deviceId: string, paymentId: string): Promise<void> {
  const db = await getDb();
  const ts = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const payment = await db.getFirstAsync<DebtPayment>("SELECT id, debt_account_id, transaction_id, payment_date, amount_centavos, notes, version FROM debt_payments WHERE id = ? AND user_id = ? AND deleted = 0", paymentId, userId);
    if (!payment) throw new LocalDbError("NOT_FOUND", "Debt payment not found.");
    await db.runAsync("UPDATE debt_payments SET deleted = 1, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", ts, paymentId, userId);
    await db.runAsync("UPDATE debt_accounts SET current_balance_centavos = current_balance_centavos + ?, status = 'active', paid_off_at = NULL, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", payment.amount_centavos, ts, payment.debt_account_id, userId);
    await enqueueOperation(db, { userId, deviceId, entity: "debt_payments", recordId: payment.id, operationType: "delete", baseVersion: payment.version, changedFields: [], payload: { id: payment.id }, failureMessage: "This debt payment could not be deleted." });
    await deleteTransaction(userId, deviceId, payment.transaction_id, { allowDebtPayment: true, db });
  });
}

export async function updateTransactionDebtPayment(userId: string, deviceId: string, paymentId: string, input: Pick<CreateExpenseInput, "amount_centavos" | "source_account_id" | "subcategory_id" | "transaction_date" | "merchant_name" | "notes">): Promise<void> {
  if (!Number.isSafeInteger(input.amount_centavos) || input.amount_centavos <= 0) throw new LocalDbError("VALIDATION_ERROR", "Payment amount must be a positive whole number.");
  const db = await getDb();
  const ts = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const payment = await db.getFirstAsync<DebtPayment>("SELECT id, debt_account_id, transaction_id, payment_date, amount_centavos, notes, version FROM debt_payments WHERE id = ? AND user_id = ? AND deleted = 0", paymentId, userId);
    if (!payment) throw new LocalDbError("NOT_FOUND", "Debt payment not found.");
    const debt = await db.getFirstAsync<{ current_balance_centavos: number }>("SELECT current_balance_centavos FROM debt_accounts WHERE id = ? AND user_id = ? AND deleted = 0", payment.debt_account_id, userId);
    if (!debt || input.amount_centavos > debt.current_balance_centavos + payment.amount_centavos) throw new LocalDbError("VALIDATION_ERROR", "Payment amount cannot exceed the current debt balance.");
    await updateTransaction(userId, deviceId, payment.transaction_id, { amount_centavos: input.amount_centavos, source_account_id: input.source_account_id, subcategory_id: input.subcategory_id, transaction_date: input.transaction_date, merchant_name: input.merchant_name ?? "", notes: input.notes ?? "" }, { allowDebtPayment: true, db });
    const currentBalance = debt.current_balance_centavos + payment.amount_centavos - input.amount_centavos;
    await db.runAsync("UPDATE debt_payments SET amount_centavos = ?, principal_centavos = ?, payment_date = ?, notes = ?, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", input.amount_centavos, input.amount_centavos, input.transaction_date, input.notes ?? null, ts, paymentId, userId);
    await db.runAsync("UPDATE debt_accounts SET current_balance_centavos = ?, status = CASE WHEN ? = 0 THEN 'paid_off' ELSE 'active' END, paid_off_at = CASE WHEN ? = 0 THEN COALESCE(paid_off_at, ?) ELSE NULL END, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", currentBalance, currentBalance, currentBalance, ts, ts, payment.debt_account_id, userId);
    await enqueueOperation(db, { userId, deviceId, entity: "debt_payments", recordId: payment.id, operationType: "update", baseVersion: payment.version, changedFields: ["amount_centavos", "principal_centavos", "payment_date", "notes"], payload: { debt_account_id: payment.debt_account_id, transaction_id: payment.transaction_id, source: "transaction", payment_date: input.transaction_date, amount_centavos: input.amount_centavos, principal_centavos: input.amount_centavos, interest_centavos: 0, notes: input.notes ?? null, linked_transaction_type: "expense", linked_source_account_id: input.source_account_id, linked_subcategory_id: input.subcategory_id }, failureMessage: "This debt payment could not be updated." });
  });
}
