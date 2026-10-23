import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation } from "../helpers";
import { randomUUID } from "../uuid";
import { detectUnusualSpendings, UNUSUAL_SPENDING_MODEL_VERSION as MODEL_VERSION, type SpendingTransaction, type UnusualSpendingInsight } from "@odin/spending-insights";
export { detectUnusualSpendings, type UnusualSpendingInsight } from "@odin/spending-insights";

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

async function listConfirmedRecurringIds(userId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ transaction_id: string }>(
    `SELECT transaction_id FROM anomaly_evaluations
      WHERE user_id = ? AND deleted = 0 AND confirmed_recurring_at IS NOT NULL`,
    userId,
  );
  return new Set(rows.map((row) => row.transaction_id));
}

export async function listUnusualSpendings(userId: string, now = new Date()): Promise<UnusualSpendingInsight[]> {
  const [transactions, confirmedRecurringIds] = await Promise.all([
    listTransactions(userId, unusualSpendingStartDate(now)),
    listConfirmedRecurringIds(userId),
  ]);
  return detectUnusualSpendings(transactions, confirmedRecurringIds);
}

export async function listPersistedUnusualSpendings(userId: string): Promise<UnusualSpendingInsight[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SpendingTransactionRow & {
    usable_history_count: number;
    usual_spending_centavos: number;
    lower_bound_centavos: number;
    upper_bound_centavos: number;
    severity: number;
    confirmed_recurring_at: string | null;
  }>(
    `SELECT t.id, t.transaction_date, t.amount_centavos, t.subcategory_id,
            s.label AS subcategory_label, a.name AS account_name,
            e.usable_history_count, e.usual_spending_centavos,
            e.lower_bound_centavos, e.upper_bound_centavos, e.severity,
            e.confirmed_recurring_at
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
      confirmedRecurring: row.confirmed_recurring_at !== null,
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

/** Records the user's "I'll be making this spending frequently" response so the expense joins its baseline. */
export async function confirmRecurringSpending(userId: string, deviceId: string, transactionId: string): Promise<void> {
  const db = await getDb();
  const timestamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ id: string; version: number; confirmed_recurring_at: string | null }>(
      "SELECT id, version, confirmed_recurring_at FROM anomaly_evaluations WHERE user_id = ? AND transaction_id = ? AND deleted = 0",
      userId, transactionId,
    );
    if (!row) throw new Error("unusual spending insight not found");
    if (row.confirmed_recurring_at !== null) return;
    await db.runAsync(
      "UPDATE anomaly_evaluations SET confirmed_recurring_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?",
      timestamp, timestamp, row.id, userId,
    );
    await enqueueOperation(db, {
      userId, deviceId, entity: "anomaly_evaluations", recordId: row.id, operationType: "update",
      baseVersion: row.version, changedFields: ["confirmed_recurring_at"],
      payload: { confirmed_recurring_at: timestamp },
      failureMessage: "Your recurring spending confirmation could not be synchronized.",
    });
  });
}

export function _resetDbCacheForTesting(): void {
  dbPromise = null;
}
