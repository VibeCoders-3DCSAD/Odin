import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";

type RecurringTemplateRow = {
  id: string;
  user_id: string;
  transaction_type: string;
  status: string;
  name: string;
  amount_centavos: number;
  subcategory_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  frequency: string;
  interval_count: number;
  day_of_month: number | null;
  second_day_of_month: number | null;
  day_of_week: number | null;
  custom_rule: string;
  starts_on: string;
  ends_on: string | null;
  next_occurrence_date: string | null;
  last_generated_date: string | null;
  reminder_enabled: number;
  reminder_days_before: number;
  notes: string | null;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

type OccurrenceRow = {
  id: string;
  recurring_template_id: string;
  user_id: string;
  scheduled_date: string;
  status: string;
  generated_transaction_id: string | null;
  reminder_sent_at: string | null;
  posted_at: string | null;
  skipped_at: string | null;
  failure_reason: string | null;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

export type RecurringTemplate = {
  id: string;
  transaction_type: string;
  status: string;
  name: string;
  amount_centavos: number;
  subcategory_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  frequency: string;
  interval_count: number;
  day_of_month: number | null;
  second_day_of_month: number | null;
  day_of_week: number | null;
  starts_on: string;
  ends_on: string | null;
  next_occurrence_date: string | null;
  last_generated_date: string | null;
  notes: string | null;
};

export type RecurringOccurrence = {
  id: string;
  recurring_template_id: string;
  scheduled_date: string;
  status: string;
  generated_transaction_id: string | null;
  posted_at: string | null;
  skipped_at: string | null;
  failure_reason: string | null;
};

export type CreateRecurringInput = {
  transaction_type: string;
  name: string;
  amount_centavos: number;
  frequency: string;
  interval_count?: number;
  day_of_month?: number;
  second_day_of_month?: number;
  day_of_week?: number;
  starts_on: string;
  ends_on?: string;
  subcategory_id?: string;
  source_account_id?: string;
  destination_account_id?: string;
  notes?: string;
};

export type UpdateRecurringInput = {
  name?: string;
  amount_centavos?: number;
  frequency?: string;
  interval_count?: number;
  day_of_month?: number | null;
  second_day_of_month?: number | null;
  day_of_week?: number | null;
  starts_on?: string;
  ends_on?: string | null;
  subcategory_id?: string | null;
  source_account_id?: string | null;
  destination_account_id?: string | null;
  notes?: string | null;
};

const VALID_TYPES = ["income", "expense", "transfer"] as const;
const VALID_FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"] as const;
const VALID_RECURRING_STATUSES = ["active", "paused", "completed", "deleted"] as const;
const VALID_OCCURRENCE_STATUSES = ["scheduled", "posted", "skipped", "failed"] as const;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function now(): string {
  return new Date().toISOString();
}

function mapRecurringTemplate(row: RecurringTemplateRow): RecurringTemplate {
  return {
    id: row.id,
    transaction_type: row.transaction_type,
    status: row.status,
    name: row.name,
    amount_centavos: row.amount_centavos,
    subcategory_id: row.subcategory_id,
    source_account_id: row.source_account_id,
    destination_account_id: row.destination_account_id,
    frequency: row.frequency,
    interval_count: row.interval_count,
    day_of_month: row.day_of_month,
    second_day_of_month: row.second_day_of_month,
    day_of_week: row.day_of_week,
    starts_on: row.starts_on,
    ends_on: row.ends_on,
    next_occurrence_date: row.next_occurrence_date,
    last_generated_date: row.last_generated_date,
    notes: row.notes,
  };
}

function mapOccurrence(row: OccurrenceRow): RecurringOccurrence {
  return {
    id: row.id,
    recurring_template_id: row.recurring_template_id,
    scheduled_date: row.scheduled_date,
    status: row.status,
    generated_transaction_id: row.generated_transaction_id,
    posted_at: row.posted_at,
    skipped_at: row.skipped_at,
    failure_reason: row.failure_reason,
  };
}

function computeNextOccurrenceDate(template: RecurringTemplateRow): string | null {
  const base = template.last_generated_date
    ? new Date(template.last_generated_date + "T00:00:00")
    : new Date(template.starts_on + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let candidate = new Date(base);

  // ponytail: simple forward search, replace with schedule library if needed
  for (let iteration = 0; iteration < 100; iteration++) {
    if (template.frequency === "daily") {
      candidate.setDate(candidate.getDate() + template.interval_count);
    } else if (template.frequency === "weekly") {
      candidate.setDate(candidate.getDate() + 7 * template.interval_count);
    } else if (template.frequency === "monthly") {
      candidate.setMonth(candidate.getMonth() + template.interval_count);
    } else if (template.frequency === "quarterly") {
      candidate.setMonth(candidate.getMonth() + 3 * template.interval_count);
    } else if (template.frequency === "yearly") {
      candidate.setFullYear(candidate.getFullYear() + template.interval_count);
    } else {
      return null; // custom not supported yet
    }

    if (template.ends_on) {
      const endDate = new Date(template.ends_on + "T00:00:00");
      if (candidate > endDate) return null;
    }

    if (candidate >= today) {
      return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`;
    }
  }

  return null;
}

export async function listRecurringTemplates(userId: string): Promise<RecurringTemplate[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecurringTemplateRow>(
    "SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND deleted = 0 AND status IN ('active', 'paused') ORDER BY next_occurrence_date",
    userId,
  );
  return rows.map(mapRecurringTemplate);
}

export async function getRecurringTemplate(userId: string, id: string): Promise<RecurringTemplate | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RecurringTemplateRow>(
    "SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND id = ? AND deleted = 0",
    userId, id,
  );
  return row ? mapRecurringTemplate(row) : null;
}

export async function createRecurringTemplate(
  userId: string,
  deviceId: string,
  input: CreateRecurringInput,
): Promise<{ template: RecurringTemplate; operation: SyncOperation }> {
  if (!input.name?.trim()) throw new LocalDbError("VALIDATION_ERROR", "name is required");
  if (!(VALID_TYPES as readonly string[]).includes(input.transaction_type)) {
    throw new LocalDbError("VALIDATION_ERROR", `transaction_type must be one of: ${VALID_TYPES.join(", ")}`);
  }
  if (!(VALID_FREQUENCIES as readonly string[]).includes(input.frequency)) {
    throw new LocalDbError("VALIDATION_ERROR", `frequency must be one of: ${VALID_FREQUENCIES.join(", ")}`);
  }
  if (typeof input.amount_centavos !== "number" || input.amount_centavos <= 0 || !Number.isInteger(input.amount_centavos)) {
    throw new LocalDbError("VALIDATION_ERROR", "amount_centavos must be a positive integer");
  }
  if (!input.starts_on) throw new LocalDbError("VALIDATION_ERROR", "starts_on is required");

  const db = await getDb();
  const id = crypto.randomUUID();
  const ts = now();

  let result: { template: RecurringTemplate; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO recurring_transaction_templates
        (id, user_id, transaction_type, status, name, amount_centavos,
         subcategory_id, source_account_id, destination_account_id,
         frequency, interval_count, day_of_month, second_day_of_month, day_of_week,
         custom_rule, starts_on, ends_on, next_occurrence_date, last_generated_date,
         reminder_enabled, reminder_days_before, notes,
         metadata, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, NULL, 0, 0, ?, '{}', 1, 0, ?, ?)`,
      id, userId, input.transaction_type, input.name.trim(), input.amount_centavos,
      input.subcategory_id ?? null, input.source_account_id ?? null, input.destination_account_id ?? null,
      input.frequency, input.interval_count ?? 1,
      input.day_of_month ?? null, input.second_day_of_month ?? null, input.day_of_week ?? null,
      input.starts_on, input.ends_on ?? null, input.starts_on,
      input.notes ?? null, ts, ts,
    );

    const operation = await enqueueOperation(db, {
      userId, deviceId,
      entity: "recurring_transaction_templates",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: [],
      payload: { ...input, name: input.name.trim() },
      failureMessage: `This recurring template "${input.name.trim()}" could not be created.`,
    });

    const row = await db.getFirstAsync<RecurringTemplateRow>(
      "SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND id = ?", userId, id,
    );
    result = { template: mapRecurringTemplate(row!), operation };
  });

  return result!;
}

export async function updateRecurringTemplate(
  userId: string,
  deviceId: string,
  id: string,
  input: UpdateRecurringInput,
): Promise<{ template: RecurringTemplate; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { template: RecurringTemplate; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<RecurringTemplateRow>(
      "SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND id = ? AND deleted = 0",
      userId, id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Recurring template not found");

    const updates: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];
    const changedFields: string[] = [];
    const fields = ["name", "amount_centavos", "frequency", "interval_count",
      "day_of_month", "second_day_of_month", "day_of_week", "starts_on", "ends_on",
      "subcategory_id", "source_account_id", "destination_account_id", "notes"] as const;

    for (const key of fields) {
      const value = (input as Record<string, unknown>)[key];
      if (value === undefined) continue;
      changedFields.push(key);
      updates.push(`${key} = ?`);
      params.push(value as SQLite.SQLiteBindValue);
    }

    if (updates.length > 0) {
      updates.push("updated_at = ?");
      params.push(ts);
      updates.push("version = version + 1");
      const sql = `UPDATE recurring_transaction_templates SET ${updates.join(", ")} WHERE user_id = ? AND id = ?`;
      params.push(userId, id);
      await db.runAsync(sql, ...params);
    }

    const operation = await enqueueOperation(db, {
      userId, deviceId,
      entity: "recurring_transaction_templates",
      recordId: id,
      operationType: "update",
      baseVersion: current.version,
      changedFields,
      payload: { ...input },
      failureMessage: `This recurring template "${input.name ?? current.name}" could not be updated.`,
    });

    const row = await db.getFirstAsync<RecurringTemplateRow>(
      "SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND id = ?", userId, id,
    );
    result = { template: mapRecurringTemplate(row!), operation };
  });

  return result!;
}

export async function deleteRecurringTemplate(
  userId: string,
  deviceId: string,
  id: string,
): Promise<{ template: RecurringTemplate; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { template: RecurringTemplate; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<RecurringTemplateRow>(
      "SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND id = ? AND deleted = 0",
      userId, id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Recurring template not found");

    await db.runAsync(
      "UPDATE recurring_transaction_templates SET status = 'deleted', deleted = 1, version = version + 1, updated_at = ? WHERE user_id = ? AND id = ?",
      ts, userId, id,
    );

    const operation = await enqueueOperation(db, {
      userId, deviceId,
      entity: "recurring_transaction_templates",
      recordId: id,
      operationType: "delete",
      baseVersion: current.version,
      changedFields: [],
      payload: { id },
      failureMessage: `This recurring template "${current.name}" could not be deleted.`,
    });

    const row = await db.getFirstAsync<RecurringTemplateRow>(
      "SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND id = ?", userId, id,
    );
    result = { template: mapRecurringTemplate(row!), operation };
  });

  return result!;
}

export async function generateNextOccurrence(
  userId: string,
  deviceId: string,
  templateId: string,
): Promise<{ occurrence: RecurringOccurrence; transaction: { id: string }; operation: SyncOperation } | null> {
  const db = await getDb();
  const ts = now();

  let result: { occurrence: RecurringOccurrence; transaction: { id: string }; operation: SyncOperation } | null = null;

  await db.withTransactionAsync(async () => {
    const template = await db.getFirstAsync<RecurringTemplateRow>(
      "SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND id = ? AND deleted = 0 AND status = 'active'",
      userId, templateId,
    );
    if (!template) throw new LocalDbError("NOT_FOUND", "Active recurring template not found");

    const nextDate = template.next_occurrence_date
      ? template.next_occurrence_date
      : computeNextOccurrenceDate(template);

    if (!nextDate) {
      // ponytail: no more occurrences to generate, mark completed
      await db.runAsync(
        "UPDATE recurring_transaction_templates SET status = 'completed', updated_at = ? WHERE user_id = ? AND id = ?",
        ts, userId, templateId,
      );
      return;
    }

    // Generate the transaction directly with recurring metadata
    const txId = crypto.randomUUID();
    try {
      const sourceId = template.transaction_type === "expense" || template.transaction_type === "transfer"
        ? template.source_account_id! : null;
      const destId = template.transaction_type === "income" || template.transaction_type === "transfer"
        ? template.destination_account_id! : null;
      const subId = template.transaction_type !== "transfer"
        ? template.subcategory_id! : null;

      // Apply balance effects
      if (template.transaction_type === "income" && destId) {
        await db.runAsync(
          "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos + ? WHERE id = ? AND user_id = ? AND deleted = 0",
          template.amount_centavos, destId, userId,
        );
      } else if (template.transaction_type === "expense" && sourceId) {
        await db.runAsync(
          "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos - ? WHERE id = ? AND user_id = ? AND deleted = 0",
          template.amount_centavos, sourceId, userId,
        );
      } else if (template.transaction_type === "transfer" && sourceId && destId) {
        await db.runAsync(
          "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos - ? WHERE id = ? AND user_id = ? AND deleted = 0",
          template.amount_centavos, sourceId, userId,
        );
        await db.runAsync(
          "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos + ? WHERE id = ? AND user_id = ? AND deleted = 0",
          template.amount_centavos, destId, userId,
        );
      }

      // Insert transaction with recurring metadata
      await db.runAsync(
        `INSERT INTO transactions
          (id, user_id, transaction_type, status, entry_source, transaction_date, posted_at,
           amount_centavos, subcategory_id, source_account_id, destination_account_id,
           recurring_template_id, merchant_name, counterparty_name, notes,
           client_mutation_id, metadata, version, deleted, created_at, updated_at)
         VALUES (?, ?, ?, 'posted', 'recurring', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '{}', 1, 0, ?, ?)`,
        txId, userId, template.transaction_type, nextDate, ts,
        template.amount_centavos, subId, sourceId, destId,
        templateId,
        template.transaction_type === "expense" ? template.name : null,
        template.transaction_type === "income" ? template.name : null,
        template.notes,
        ts, ts,
      );

      // Enqueue transaction sync operation with recurring metadata
      await enqueueOperation(db, {
        userId, deviceId,
        entity: "transactions",
        recordId: txId,
        operationType: "create",
        baseVersion: null,
        changedFields: [],
        payload: {
          transaction_type: template.transaction_type,
          amount_centavos: template.amount_centavos,
          transaction_date: nextDate,
          subcategory_id: subId,
          source_account_id: sourceId,
          destination_account_id: destId,
          merchant_name: template.transaction_type === "expense" ? template.name : null,
          counterparty_name: template.transaction_type === "income" ? template.name : null,
          notes: template.notes,
        },
        failureMessage: `This recurring transaction could not be created.`,
      });
    } catch (e) {
      // ponytail: if transaction creation fails, mark failure and continue
      const occId = crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO recurring_transaction_occurrences
          (id, recurring_template_id, user_id, scheduled_date, status, failure_reason,
           metadata, version, deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'failed', ?, '{}', 1, 0, ?, ?)`,
        occId, templateId, userId, nextDate,
        e instanceof Error ? e.message : "Unknown error",
        ts, ts,
      );
      return;
    }

    // ponytail: transaction already created with entry_source='recurring' and recurring_template_id

    // Create occurrence record
    const occId = crypto.randomUUID();
    await db.runAsync(
      `INSERT INTO recurring_transaction_occurrences
        (id, recurring_template_id, user_id, scheduled_date, status,
         generated_transaction_id, posted_at,
         metadata, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'posted', ?, ?, '{}', 1, 0, ?, ?)`,
      occId, templateId, userId, nextDate,
      txId, ts,
      ts, ts,
    );

    const operation = await enqueueOperation(db, {
      userId, deviceId,
      entity: "recurring_transaction_occurrences",
      recordId: occId,
      operationType: "create",
      baseVersion: null,
      changedFields: [],
      payload: { recurring_template_id: templateId, scheduled_date: nextDate, generated_transaction_id: txId },
      failureMessage: `This recurring occurrence could not be created.`,
    });

    // Schedule next occurrence
    const nextNextDate = computeNextOccurrenceDate(template);
    await db.runAsync(
      `UPDATE recurring_transaction_templates
       SET next_occurrence_date = ?, last_generated_date = ?, updated_at = ?
       WHERE user_id = ? AND id = ?`,
      nextNextDate, nextDate, ts, userId, templateId,
    );

    const occurRow = await db.getFirstAsync<OccurrenceRow>(
      "SELECT * FROM recurring_transaction_occurrences WHERE user_id = ? AND id = ?", userId, occId,
    );

    result = {
      occurrence: mapOccurrence(occurRow!),
      transaction: { id: txId },
      operation,
    };
  });

  return result;
}
