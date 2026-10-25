import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation } from "../helpers";
import { randomUUID } from "../uuid";
import { detectUnusualSpendings, UNUSUAL_SPENDING_MODEL_VERSION as MODEL_VERSION, type SpendingRecurrence, type SpendingTransaction, type UnusualSpendingInsight } from "@odin/spending-insights";
export { detectUnusualSpendings, type SpendingRecurrence, type UnusualSpendingInsight } from "@odin/spending-insights";

const MAX_TRANSACTIONS = 5_000;

type SpendingTransactionRow = {
  id: string;
  transaction_date: string;
  amount_centavos: number;
  subcategory_id: string;
  subcategory_label: string | null;
  account_name: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

export function unusualSpendingStartDate(now = new Date()): string {
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - 12);
  return start.toISOString().slice(0, 10);
}

async function listTransactions(userId: string, fromDate: string): Promise<SpendingTransaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SpendingTransactionRow>(
    `SELECT t.id, t.transaction_date, t.amount_centavos, t.subcategory_id,
            s.label AS subcategory_label, a.name AS account_name
       FROM transactions t
       JOIN subcategories s ON s.id = t.subcategory_id AND s.user_id = t.user_id AND s.deleted = 0
       JOIN categories c ON c.id = s.category_id AND c.user_id = t.user_id AND c.deleted = 0
       LEFT JOIN financial_accounts a ON a.id = t.source_account_id
         AND a.user_id = t.user_id AND a.deleted = 0
      WHERE t.user_id = ? AND t.transaction_type = 'expense' AND t.status = 'posted'
        AND t.deleted = 0 AND t.transaction_date >= ? AND t.amount_centavos > 0
      ORDER BY t.transaction_date ASC, t.id ASC
      LIMIT ${MAX_TRANSACTIONS}`,
    userId,
    fromDate,
  );
  return rows.flatMap((row) => row.subcategory_label && Number.isInteger(row.amount_centavos)
    ? [{ id: row.id, transactionDate: row.transaction_date, amountCentavos: row.amount_centavos, subcategoryId: row.subcategory_id, subcategoryLabel: row.subcategory_label, accountName: row.account_name }]
    : []);
}

/** Every saved unusual-spending evaluation by transaction ID, with the user's answer or null if unanswered. */
export async function listSavedRecurrences(userId: string): Promise<Map<string, SpendingRecurrence | null>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ transaction_id: string; recurrence: SpendingRecurrence | null }>(
    "SELECT transaction_id, recurrence FROM anomaly_evaluations WHERE user_id = ? AND deleted = 0",
    userId,
  );
  return new Map(rows.map((row) => [row.transaction_id, row.recurrence]));
}

export async function listUnusualSpendings(userId: string, now = new Date()): Promise<UnusualSpendingInsight[]> {
  const [transactions, recurrences] = await Promise.all([
    listTransactions(userId, unusualSpendingStartDate(now)),
    listSavedRecurrences(userId),
  ]);
  return detectUnusualSpendings(transactions, recurrences);
}

export async function listPersistedUnusualSpendings(userId: string): Promise<UnusualSpendingInsight[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SpendingTransactionRow & {
    usable_history_count: number;
    usual_spending_centavos: number;
    lower_bound_centavos: number;
    upper_bound_centavos: number;
    severity: number;
    recurrence: SpendingRecurrence | null;
  }>(
    `SELECT t.id, t.transaction_date, t.amount_centavos, t.subcategory_id,
            s.label AS subcategory_label, a.name AS account_name,
            e.usable_history_count, e.usual_spending_centavos,
            e.lower_bound_centavos, e.upper_bound_centavos, e.severity,
            e.recurrence
       FROM anomaly_evaluations e
       JOIN transactions t ON t.id = e.transaction_id
         AND t.user_id = e.user_id AND t.deleted = 0
       JOIN subcategories s ON s.id = e.subcategory_id AND s.user_id = e.user_id AND s.deleted = 0
       LEFT JOIN financial_accounts a ON a.id = t.source_account_id
         AND a.user_id = t.user_id AND a.deleted = 0
      WHERE e.user_id = ? AND e.deleted = 0
        AND t.transaction_type = 'expense' AND t.status = 'posted' AND t.subcategory_id = e.subcategory_id
      ORDER BY t.transaction_date ASC, t.id ASC`,
    userId,
  );
  return rows.flatMap((row) => row.subcategory_label
    ? [{
      transactionId: row.id,
      amountCentavos: row.amount_centavos,
      subcategoryLabel: row.subcategory_label,
      accountName: row.account_name,
      transactionDate: row.transaction_date,
      usualSpendingCentavos: row.usual_spending_centavos,
      lowerBoundCentavos: row.lower_bound_centavos,
      upperBoundCentavos: row.upper_bound_centavos,
      severity: row.severity,
      usableHistoryCount: row.usable_history_count,
      subcategoryId: row.subcategory_id,
      confirmedRecurring: row.recurrence === "frequent",
      recurrence: row.recurrence,
    }]
    : []);
}

export async function getUnusualSpending(userId: string, transactionId: string): Promise<UnusualSpendingInsight | null> {
  const insights = await listUnusualSpendings(userId);
  return insights.find((insight) => insight.transactionId === transactionId) ?? null;
}

export async function saveUnusualSpending(userId: string, deviceId: string, insight: UnusualSpendingInsight): Promise<void> {
  const db = await getDb();
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR IGNORE INTO anomaly_evaluations
       (id, user_id, transaction_id, subcategory_id, amount_centavos, usable_history_count,
        usual_spending_centavos, lower_bound_centavos, upper_bound_centavos, severity,
        model_version, evaluated_at, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      id, userId, insight.transactionId, insight.subcategoryId, insight.amountCentavos,
      insight.usableHistoryCount, insight.usualSpendingCentavos, insight.lowerBoundCentavos,
      insight.upperBoundCentavos, insight.severity, MODEL_VERSION, timestamp, timestamp, timestamp,
    );
    const row = await db.getFirstAsync<{ id: string }>("SELECT id FROM anomaly_evaluations WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, insight.transactionId);
    if (row?.id !== id) return;
    await enqueueOperation(db, {
      userId, deviceId, entity: "anomaly_evaluations", recordId: id, operationType: "create",
      baseVersion: null, changedFields: [],
      payload: { transaction_id: insight.transactionId, subcategory_id: insight.subcategoryId, amount_centavos: insight.amountCentavos, usable_history_count: insight.usableHistoryCount, usual_spending_centavos: insight.usualSpendingCentavos, lower_bound_centavos: insight.lowerBoundCentavos, upper_bound_centavos: insight.upperBoundCentavos, severity: insight.severity, model_version: MODEL_VERSION, evaluated_at: timestamp },
      failureMessage: "This unusual spending insight could not be synchronized.",
    });
  });
}

/**
 * Records the user's answer to an unusual expense. A frequent expense joins its baseline; a yearly one
 * stays out of it and recurs in the forecast a year later; a one-time expense is left out of both.
 * The first answer is final.
 */
export async function answerUnusualSpending(userId: string, deviceId: string, transactionId: string, recurrence: SpendingRecurrence): Promise<void> {
  const db = await getDb();
  const timestamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ id: string; version: number; recurrence: SpendingRecurrence | null }>(
      "SELECT id, version, recurrence FROM anomaly_evaluations WHERE user_id = ? AND transaction_id = ? AND deleted = 0",
      userId, transactionId,
    );
    if (!row) throw new Error("unusual spending insight not found");
    if (row.recurrence !== null) return;
    // confirmed_recurring_at still marks frequent spending for app versions that predate the answer.
    const confirmedAt = recurrence === "frequent" ? timestamp : null;
    await db.runAsync(
      "UPDATE anomaly_evaluations SET recurrence = ?, confirmed_recurring_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?",
      recurrence, confirmedAt, timestamp, row.id, userId,
    );
    await enqueueOperation(db, {
      userId, deviceId, entity: "anomaly_evaluations", recordId: row.id, operationType: "update",
      baseVersion: row.version,
      changedFields: confirmedAt ? ["recurrence", "confirmed_recurring_at"] : ["recurrence"],
      payload: confirmedAt ? { recurrence, confirmed_recurring_at: confirmedAt } : { recurrence },
      failureMessage: "Your unusual spending answer could not be synchronized.",
    });
  });
}

export function _resetDbCacheForTesting(): void {
  dbPromise = null;
}
