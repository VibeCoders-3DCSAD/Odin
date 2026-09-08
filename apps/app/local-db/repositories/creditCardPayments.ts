import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";
import { createExpenseInTransaction, deleteTransaction, updateTransaction, type CreateExpenseInput, type Transaction } from "./ledger";
import { validateIsoDate } from "./creditCardCycleDates";

export type CreditCardPaymentStatus = "fully_paid" | "minimum_satisfied" | "partially_paid";

export type CreditCardPayment = {
  id: string;
  user_id: string;
  cycle_id: string;
  statement_id: string;
  transaction_id: string;
  amount_centavos: number;
  payment_date: string;
  source_account_id: string;
  notes: string | null;
  issuer_recognized: boolean;
  client_mutation_id: string;
  version: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
};

type PaymentRow = Omit<CreditCardPayment, "issuer_recognized" | "deleted"> & { issuer_recognized: number; deleted: number };

export type StatementPaymentContext = { statementId: string; cycleId: string };

export type CreateStatementPaymentInput = StatementPaymentContext & Pick<CreateExpenseInput,
  "amount_centavos" | "source_account_id" | "subcategory_id" | "transaction_date" | "merchant_name" | "notes"
>;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function mapPayment(row: PaymentRow): CreditCardPayment {
  return { ...row, issuer_recognized: row.issuer_recognized === 1, deleted: row.deleted === 1 };
}

function timestamp(): string {
  return new Date().toISOString();
}

export function calculateCreditCardPaymentStatus(
  amountCentavos: number,
  statementBalanceCentavos: number,
  minimumDueCentavos: number,
): CreditCardPaymentStatus {
  if (amountCentavos >= statementBalanceCentavos) return "fully_paid";
  if (amountCentavos >= minimumDueCentavos) return "minimum_satisfied";
  return "partially_paid";
}

export function creditBalanceCentavos(amountCentavos: number, statementBalanceCentavos: number): number {
  return Math.max(0, amountCentavos - statementBalanceCentavos);
}

async function validateStatementContext(
  db: SQLite.SQLiteDatabase,
  userId: string,
  context: StatementPaymentContext,
): Promise<{ id: string; statement_balance_centavos: number }> {
  const statement = await db.getFirstAsync<{ id: string; statement_balance_centavos: number }>(
    `SELECT s.id, s.statement_balance_centavos
       FROM credit_card_statements s
       JOIN credit_card_cycles c ON c.id = s.cycle_id AND c.user_id = s.user_id
      WHERE s.id = ? AND s.cycle_id = ? AND s.user_id = ?
        AND s.authoritative = 1 AND s.deleted = 0 AND c.deleted = 0`,
    context.statementId, context.cycleId, userId,
  );
  if (!statement) throw new LocalDbError("NOT_FOUND", "Credit-card statement not found.");
  return statement;
}

export async function getCreditCardPaymentByStatement(userId: string, statementId: string): Promise<CreditCardPayment | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PaymentRow>(
    "SELECT * FROM credit_card_payments WHERE user_id = ? AND statement_id = ? AND deleted = 0",
    userId, statementId,
  );
  return row ? mapPayment(row) : null;
}

export async function listCreditCardPayments(userId: string): Promise<CreditCardPayment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PaymentRow>(
    "SELECT * FROM credit_card_payments WHERE user_id = ? AND deleted = 0 ORDER BY payment_date DESC",
    userId,
  );
  return rows.map(mapPayment);
}

export async function createStatementPayment(
  userId: string,
  deviceId: string,
  input: CreateStatementPaymentInput,
): Promise<{ payment: CreditCardPayment; transaction: Transaction; operations: SyncOperation[] }> {
  if (!Number.isSafeInteger(input.amount_centavos) || input.amount_centavos <= 0) {
    throw new LocalDbError("VALIDATION_ERROR", "Payment amount must be a positive whole number.");
  }
  validateIsoDate(input.transaction_date, "paymentDate");
  const db = await getDb();
  const id = randomUUID();
  const clientMutationId = randomUUID();
  const ts = timestamp();
  let result!: { payment: CreditCardPayment; transaction: Transaction; operations: SyncOperation[] };

  await db.withTransactionAsync(async () => {
    const statement = await validateStatementContext(db, userId, input);
    if (input.amount_centavos > statement.statement_balance_centavos) {
      throw new LocalDbError("VALIDATION_ERROR", "Payment amount cannot exceed the statement balance.");
    }
    const source = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM financial_accounts WHERE id = ? AND user_id = ? AND kind <> 'credit_card' AND status = 'active' AND deleted = 0",
      input.source_account_id, userId,
    );
    if (!source) throw new LocalDbError("VALIDATION_ERROR", "Select an active non-credit-card source account.");
    const existing = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM credit_card_payments WHERE user_id = ? AND cycle_id = ? AND deleted = 0",
      userId, input.cycleId,
    );
    if (existing) throw new LocalDbError("VALIDATION_ERROR", "A payment is already recorded for this billing cycle.");

    const { transaction, operation: transactionOperation } = await createExpenseInTransaction(db, userId, deviceId, {
      amount_centavos: input.amount_centavos,
      source_account_id: input.source_account_id,
      subcategory_id: input.subcategory_id,
      transaction_date: input.transaction_date,
      merchant_name: input.merchant_name,
      notes: input.notes,
      client_mutation_id: clientMutationId,
    });
    const paymentPayload = {
      cycle_id: input.cycleId,
      statement_id: input.statementId,
      transaction_id: transaction.id,
      amount_centavos: input.amount_centavos,
      payment_date: input.transaction_date,
      source_account_id: input.source_account_id,
      notes: input.notes ?? null,
      client_mutation_id: clientMutationId,
    };
    await db.runAsync(
      `INSERT INTO credit_card_payments
        (id, user_id, cycle_id, statement_id, transaction_id, amount_centavos, payment_date,
         source_account_id, notes, issuer_recognized, client_mutation_id, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, 0, ?, ?)`,
      id, userId, input.cycleId, input.statementId, transaction.id, input.amount_centavos,
      input.transaction_date, input.source_account_id, input.notes ?? null, clientMutationId, ts, ts,
    );
    const paymentOperation = await enqueueOperation(db, {
      userId, deviceId, entity: "credit_card_payments", recordId: id, operationType: "create", baseVersion: null,
      changedFields: Object.keys(paymentPayload), payload: paymentPayload,
      failureMessage: "This credit-card payment could not be recorded.",
    });
    const row = await db.getFirstAsync<PaymentRow>("SELECT * FROM credit_card_payments WHERE id = ? AND user_id = ?", id, userId);
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "Failed to read recorded credit-card payment.");
    result = { payment: mapPayment(row), transaction, operations: [transactionOperation, paymentOperation] };
  });
  return result;
}

export async function updateStatementPayment(
  userId: string,
  deviceId: string,
  paymentId: string,
  input: Pick<CreateStatementPaymentInput, "amount_centavos" | "source_account_id" | "subcategory_id" | "transaction_date" | "merchant_name" | "notes">,
): Promise<void> {
  const db = await getDb();
  const ts = timestamp();
  await db.withTransactionAsync(async () => {
    const payment = await db.getFirstAsync<PaymentRow>(
      "SELECT * FROM credit_card_payments WHERE id = ? AND user_id = ? AND deleted = 0", paymentId, userId,
    );
    if (!payment) throw new LocalDbError("NOT_FOUND", "Credit-card payment not found.");
    if (!Number.isSafeInteger(input.amount_centavos) || input.amount_centavos <= 0) throw new LocalDbError("VALIDATION_ERROR", "Payment amount must be a positive whole number.");
    validateIsoDate(input.transaction_date, "paymentDate");
    const statement = await validateStatementContext(db, userId, { statementId: payment.statement_id, cycleId: payment.cycle_id });
    if (input.amount_centavos > statement.statement_balance_centavos) {
      throw new LocalDbError("VALIDATION_ERROR", "Payment amount cannot exceed the statement balance.");
    }
    await updateTransaction(userId, deviceId, payment.transaction_id, {
      amount_centavos: input.amount_centavos, source_account_id: input.source_account_id,
      subcategory_id: input.subcategory_id, transaction_date: input.transaction_date,
      merchant_name: input.merchant_name ?? "", notes: input.notes ?? "",
    }, { allowStatementPayment: true, db });
    await db.runAsync(
      `UPDATE credit_card_payments SET amount_centavos = ?, payment_date = ?, source_account_id = ?, notes = ?,
       version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?`,
      input.amount_centavos, input.transaction_date, input.source_account_id, input.notes ?? null, ts, paymentId, userId,
    );
    await enqueueOperation(db, {
      userId, deviceId, entity: "credit_card_payments", recordId: paymentId, operationType: "update", baseVersion: payment.version,
      changedFields: ["amount_centavos", "payment_date", "source_account_id", "notes"],
      payload: { amount_centavos: input.amount_centavos, payment_date: input.transaction_date, source_account_id: input.source_account_id, notes: input.notes ?? null },
      failureMessage: "This credit-card payment could not be updated.",
    });
  });
}

export async function deleteStatementPayment(userId: string, deviceId: string, paymentId: string): Promise<void> {
  const db = await getDb();
  const ts = timestamp();
  await db.withTransactionAsync(async () => {
    const payment = await db.getFirstAsync<PaymentRow>(
      "SELECT * FROM credit_card_payments WHERE id = ? AND user_id = ? AND deleted = 0", paymentId, userId,
    );
    if (!payment) throw new LocalDbError("NOT_FOUND", "Credit-card payment not found.");
    await db.runAsync("UPDATE credit_card_payments SET deleted = 1, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", ts, paymentId, userId);
    await enqueueOperation(db, {
      userId, deviceId, entity: "credit_card_payments", recordId: paymentId, operationType: "delete", baseVersion: payment.version,
      changedFields: [], payload: { id: paymentId }, failureMessage: "This credit-card payment could not be deleted.",
    });
    await deleteTransaction(userId, deviceId, payment.transaction_id, { allowStatementPayment: true, db });
  });
}
