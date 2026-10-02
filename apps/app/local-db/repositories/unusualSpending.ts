import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation } from "../helpers";
import { randomUUID } from "../uuid";

const MINIMUM_HISTORY = 6;
const IQR_MULTIPLIER = 1.5;
const MAX_TRANSACTIONS = 5_000;

type SpendingTransaction = {
  id: string;
  transactionDate: string;
  amountCentavos: number;
  subcategoryId: string;
  subcategoryLabel: string;
  accountName: string | null;
};

type SpendingTransactionRow = {
  id: string;
  transaction_date: string;
  amount_centavos: number;
  subcategory_id: string;
  subcategory_label: string | null;
  account_name: string | null;
};

export type UnusualSpendingInsight = {
  transactionId: string;
  amountCentavos: number;
  subcategoryLabel: string;
  accountName: string | null;
  transactionDate: string;
  usualSpendingCentavos: number;
  lowerBoundCentavos: number;
  upperBoundCentavos: number;
  severity: number;
  usableHistoryCount: number;
  subcategoryId: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function percentile(sorted: number[], proportion: number): number {
  const position = (sorted.length - 1) * proportion;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

function spansThreeCalendarMonths(firstDate: string, candidateDate: string): boolean {
  const first = new Date(`${firstDate}T00:00:00.000Z`);
  const candidate = new Date(`${candidateDate}T00:00:00.000Z`);
  return (candidate.getUTCFullYear() - first.getUTCFullYear()) * 12 + candidate.getUTCMonth() - first.getUTCMonth() >= 3;
}

export function unusualSpendingStartDate(now = new Date()): string {
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - 12);
  return start.toISOString().slice(0, 10);
}

export function detectUnusualSpendings(transactions: SpendingTransaction[]): UnusualSpendingInsight[] {
  const histories = new Map<string, SpendingTransaction[]>();
  const insights: UnusualSpendingInsight[] = [];
  const ordered = [...transactions].sort((first, second) => first.transactionDate.localeCompare(second.transactionDate) || first.id.localeCompare(second.id));

  for (const transaction of ordered) {
    const history = histories.get(transaction.subcategoryId) ?? [];
    if (history.length >= MINIMUM_HISTORY && spansThreeCalendarMonths(history[0]!.transactionDate, transaction.transactionDate)) {
      const values = history.map((item) => Math.log1p(item.amountCentavos / 100)).sort((first, second) => first - second);
      const q1 = percentile(values, 0.25);
      const q3 = percentile(values, 0.75);
      const iqr = q3 - q1;
      if (iqr > 0) {
        const lower = q1 - IQR_MULTIPLIER * iqr;
        const upper = q3 + IQR_MULTIPLIER * iqr;
        const value = Math.log1p(transaction.amountCentavos / 100);
        if (value < lower || value > upper) {
          const usualSpending = percentile(history.map((item) => item.amountCentavos).sort((first, second) => first - second), 0.5);
          insights.push({
            transactionId: transaction.id,
            amountCentavos: transaction.amountCentavos,
            subcategoryLabel: transaction.subcategoryLabel,
            accountName: transaction.accountName,
            transactionDate: transaction.transactionDate,
            usualSpendingCentavos: Math.round(usualSpending),
            lowerBoundCentavos: Math.max(0, Math.round(Math.expm1(lower) * 100)),
            upperBoundCentavos: Math.max(0, Math.round(Math.expm1(upper) * 100)),
            severity: Math.max(lower - value, value - upper) / iqr,
            usableHistoryCount: history.length,
            subcategoryId: transaction.subcategoryId,
          });
        }
      }
    }
    history.push(transaction);
    histories.set(transaction.subcategoryId, history);
  }
  return insights;
}

async function listTransactions(userId: string, fromDate: string): Promise<SpendingTransaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SpendingTransactionRow>(
    `SELECT t.id, t.transaction_date, t.amount_centavos, t.subcategory_id,
            s.label AS subcategory_label, a.name AS account_name
       FROM transactions t
       JOIN subcategories s ON s.id = t.subcategory_id AND s.deleted = 0
       JOIN categories c ON c.id = s.category_id AND c.deleted = 0
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

export async function listUnusualSpendings(userId: string, now = new Date()): Promise<UnusualSpendingInsight[]> {
  return detectUnusualSpendings(await listTransactions(userId, unusualSpendingStartDate(now)));
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'personal-transaction-iqr-local-v1', ?, 1, 0, ?, ?)`,
      id, userId, insight.transactionId, insight.subcategoryId, insight.amountCentavos,
      insight.usableHistoryCount, insight.usualSpendingCentavos, insight.lowerBoundCentavos,
      insight.upperBoundCentavos, insight.severity, timestamp, timestamp, timestamp,
    );
    const row = await db.getFirstAsync<{ id: string }>("SELECT id FROM anomaly_evaluations WHERE user_id = ? AND transaction_id = ? AND deleted = 0", userId, insight.transactionId);
    if (row?.id !== id) return;
    await enqueueOperation(db, {
      userId, deviceId, entity: "anomaly_evaluations", recordId: id, operationType: "create",
      baseVersion: null, changedFields: [],
      payload: { transaction_id: insight.transactionId, subcategory_id: insight.subcategoryId, amount_centavos: insight.amountCentavos, usable_history_count: insight.usableHistoryCount, usual_spending_centavos: insight.usualSpendingCentavos, lower_bound_centavos: insight.lowerBoundCentavos, upper_bound_centavos: insight.upperBoundCentavos, severity: insight.severity, model_version: "personal-transaction-iqr-local-v1", evaluated_at: timestamp },
      failureMessage: "This unusual spending insight could not be synchronized.",
    });
  });
}

export function _resetDbCacheForTesting(): void {
  dbPromise = null;
}
