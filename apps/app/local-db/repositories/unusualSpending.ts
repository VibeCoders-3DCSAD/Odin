import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation } from "../helpers";
import { randomUUID } from "../uuid";
import { detectRecurringPayments, detectUnusualSpendings, UNUSUAL_SPENDING_MODEL_VERSION as MODEL_VERSION, type SpendingRecurrence, type SpendingTransaction, type UnusualSpendingInsight } from "@odin/spending-insights";
import { normalizeRecurrenceMonths } from "@odin/spending-insights/recurringMonths";
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


function getDb(): Promise<SQLite.SQLiteDatabase> {
  return initDatabase();
}

export function unusualSpendingStartDate(now = new Date()): string {
  const start = new Date(now);
  // 13 months, so last year's yearly expenses are still in range when their anniversary comes round.
  start.setUTCMonth(start.getUTCMonth() - 13);
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

export type SavedAnswers = {
  // Every saved unusual-spending evaluation by transaction ID, with the user's answer or null if unanswered.
  recurrences: Map<string, SpendingRecurrence | null>;
  // The calendar months (1-12) each yearly answer comes back in, when the user chose them.
  months: Map<string, number[]>;
};

// The stored JSON month list, or null when absent or malformed.
function parseRecurrenceMonths(value: string | null): number[] | null {
  if (!value) return null;
  try {
    return normalizeRecurrenceMonths(JSON.parse(value));
  } catch {
    return null;
  }
}

export async function listSavedAnswers(userId: string): Promise<SavedAnswers> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ transaction_id: string; recurrence: SpendingRecurrence | null; recurrence_months: string | null }>(
    "SELECT transaction_id, recurrence, recurrence_months FROM anomaly_evaluations WHERE user_id = ? AND deleted = 0",
    userId,
  );
  return {
    recurrences: new Map(rows.map((row) => [row.transaction_id, row.recurrence])),
    months: new Map(rows.flatMap((row) => {
      const months = row.recurrence === "yearly" ? parseRecurrenceMonths(row.recurrence_months) : null;
      return months ? [[row.transaction_id, months] as const] : [];
    })),
  };
}

async function detectionInputs(userId: string, now: Date): Promise<[SpendingTransaction[], SavedAnswers]> {
  return Promise.all([listTransactions(userId, unusualSpendingStartDate(now)), listSavedAnswers(userId)]);
}

export async function listUnusualSpendings(userId: string, now = new Date()): Promise<UnusualSpendingInsight[]> {
  const [transactions, saved] = await detectionInputs(userId, now);
  return detectUnusualSpendings(transactions, saved.recurrences, saved.months);
}

/** Payments that come back in certain months: answered yearly, or covered by such an answer. */
export async function listRecurringPayments(userId: string, now = new Date()): Promise<Array<SpendingTransaction & { months: number[] | null }>> {
  const [transactions, saved] = await detectionInputs(userId, now);
  return detectRecurringPayments(transactions, saved.recurrences, saved.months);
}

// Only spending above the usual range is worth an alert; unusually low spending is still detected,
// so it stays out of the forecast and baselines, but is never shown.
function isHigherSpending(insight: UnusualSpendingInsight): boolean {
  return insight.amountCentavos > insight.usualSpendingCentavos;
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
    recurrence_months: string | null;
  }>(
    `SELECT t.id, t.transaction_date, t.amount_centavos, t.subcategory_id,
            s.label AS subcategory_label, a.name AS account_name,
            e.usable_history_count, e.usual_spending_centavos,
            e.lower_bound_centavos, e.upper_bound_centavos, e.severity,
            e.recurrence, e.recurrence_months
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
      recurrenceMonths: row.recurrence === "yearly" ? parseRecurrenceMonths(row.recurrence_months) : null,
    }]
    : []).filter(isHigherSpending);
}

export async function getUnusualSpending(userId: string, transactionId: string): Promise<UnusualSpendingInsight | null> {
  const insights = await listUnusualSpendings(userId);
  return insights.find((insight) => insight.transactionId === transactionId && isHigherSpending(insight)) ?? null;
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

type AnswerRow = { id: string; version: number; recurrence: SpendingRecurrence | null };

// Saves an answer to the user's evaluation of transactionId and queues its sync, when canAnswer allows it.
async function writeAnswer(
  userId: string, deviceId: string, transactionId: string, recurrence: SpendingRecurrence, months: number[] | null,
  canAnswer: (current: SpendingRecurrence | null) => boolean,
): Promise<void> {
  const db = await getDb();
  const timestamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<AnswerRow>(
      "SELECT id, version, recurrence FROM anomaly_evaluations WHERE user_id = ? AND transaction_id = ? AND deleted = 0",
      userId, transactionId,
    );
    if (!row) throw new Error("unusual spending insight not found");
    if (!canAnswer(row.recurrence)) return;
    // confirmed_recurring_at still marks frequent spending for app versions that predate the answer.
    const confirmedAt = recurrence === "frequent" ? timestamp : null;
    // A revised answer always sends its months, so removing an answer clears them.
    const revising = row.recurrence !== null;
    await db.runAsync(
      "UPDATE anomaly_evaluations SET recurrence = ?, confirmed_recurring_at = ?, recurrence_months = ?, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?",
      recurrence, confirmedAt, months ? JSON.stringify(months) : null, timestamp, row.id, userId,
    );
    await enqueueOperation(db, {
      userId, deviceId, entity: "anomaly_evaluations", recordId: row.id, operationType: "update",
      baseVersion: row.version,
      changedFields: ["recurrence", ...(confirmedAt ? ["confirmed_recurring_at"] : []), ...(months || revising ? ["recurrence_months"] : [])],
      payload: { recurrence, ...(confirmedAt ? { confirmed_recurring_at: confirmedAt } : {}), ...(months || revising ? { recurrence_months: months } : {}) },
      failureMessage: "Your unusual spending answer could not be synchronized.",
    });
  });
}

function requireMonths(recurrenceMonths: readonly number[]): number[] {
  const months = normalizeRecurrenceMonths(recurrenceMonths);
  if (!months) throw new Error("recurrence months need a yearly answer and distinct months from 1 to 12");
  return months;
}

/**
 * Records the user's answer to an unusual expense. A frequent expense joins its baseline; a yearly one
 * stays out of it and recurs in the forecast in the months chosen (its own month without them);
 * a one-time expense is left out of both. The first answer is final, apart from the edits below.
 */
export async function answerUnusualSpending(userId: string, deviceId: string, transactionId: string, recurrence: SpendingRecurrence, recurrenceMonths?: readonly number[]): Promise<void> {
  if (recurrenceMonths !== undefined && recurrence !== "yearly") throw new Error("recurrence months need a yearly answer and distinct months from 1 to 12");
  const months = recurrenceMonths === undefined ? null : requireMonths(recurrenceMonths);
  await writeAnswer(userId, deviceId, transactionId, recurrence, months, (current) => current === null);
}

/** Changes the months a payment answered "in certain months" comes back in. */
export async function changeRecurrenceMonths(userId: string, deviceId: string, transactionId: string, recurrenceMonths: readonly number[]): Promise<void> {
  await writeAnswer(userId, deviceId, transactionId, "yearly", requireMonths(recurrenceMonths), (current) => current === "yearly");
}

/** Stops expecting a payment answered "in certain months"; it becomes a one-time expense. */
export async function stopRecurrence(userId: string, deviceId: string, transactionId: string): Promise<void> {
  await writeAnswer(userId, deviceId, transactionId, "one_time", null, (current) => current === "yearly");
}

/** Revises a consolidated payment's answers atomically, queuing each evaluation for sync. */
export async function reviseRecurringPaymentGroup(userId: string, deviceId: string, transactionIds: readonly string[], recurrenceMonths: readonly number[] | null): Promise<void> {
  const ids = [...new Set(transactionIds)];
  if (!ids.length) throw new Error("recurring payment group is empty");
  const months = recurrenceMonths === null ? null : requireMonths(recurrenceMonths);
  const recurrence = months ? "yearly" : "one_time";
  const placeholders = ids.map(() => "?").join(", ");
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const rows = await db.getAllAsync<AnswerRow>(
      `SELECT id, version, recurrence FROM anomaly_evaluations WHERE user_id = ? AND transaction_id IN (${placeholders}) AND deleted = 0`,
      userId, ...ids,
    );
    if (rows.length !== ids.length || rows.some((row) => row.recurrence !== "yearly")) {
      throw new Error("recurring payment group has changed; reload before editing");
    }
    await db.runAsync(
      `UPDATE anomaly_evaluations SET recurrence = ?, confirmed_recurring_at = NULL, recurrence_months = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND transaction_id IN (${placeholders}) AND deleted = 0`,
      recurrence, months ? JSON.stringify(months) : null, new Date().toISOString(), userId, ...ids,
    );
    for (const row of rows) {
      await enqueueOperation(db, {
        userId, deviceId, entity: "anomaly_evaluations", recordId: row.id, operationType: "update",
        baseVersion: row.version, changedFields: ["recurrence", "recurrence_months"],
        payload: { recurrence, recurrence_months: months },
        failureMessage: "Your unusual spending answer could not be synchronized.",
      });
    }
  });
}
