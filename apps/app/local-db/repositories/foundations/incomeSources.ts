import * as SQLite from "expo-sqlite";
import { enqueueOperation, LocalDbError } from "../../helpers";
import { randomUUID } from "../../uuid";
import type { SyncOperation } from "../../types";
import { getDb, now, boolToInt } from "../helpers/db";
import { assertIncomeAmount, assertIncomeSchedule, normalizeIncomeSchedule } from "./incomeSchedule";
import { assertAccessibleIncomeDestinationAndCategory, syncIncomeSourceRecurringTemplate } from "./incomeSourceLinks";
import {
  mapIncomeSource,
  type CreateIncomeSourceInput,
  type IncomeFrequency,
  type IncomeSource,
  type IncomeSourceRow,
  type UpdateIncomeSourceInput,
} from "./incomeSourceModel";

// ---------------------------------------------------------------------------
// Income Sources
// ---------------------------------------------------------------------------

export async function listIncomeSources(userId: string): Promise<IncomeSource[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<IncomeSourceRow>(
    "SELECT * FROM income_sources WHERE user_id = ? AND deleted = 0 ORDER BY name",
    userId,
  );
  return rows.map(mapIncomeSource);
}

export async function getIncomeSource(
  userId: string,
  id: string,
): Promise<IncomeSource | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<IncomeSourceRow>(
    "SELECT * FROM income_sources WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    id,
  );
  return row ? mapIncomeSource(row) : null;
}

export async function createIncomeSource(
  userId: string,
  deviceId: string,
  input: CreateIncomeSourceInput,
): Promise<{ source: IncomeSource; operation: SyncOperation }> {
  if (!input.name || !input.frequency || !input.destinationAccountId || !input.subcategoryId) {
    throw new LocalDbError("VALIDATION_ERROR", "name, frequency, destinationAccountId, and subcategoryId are required");
  }
  assertIncomeAmount(input.expectedAmountCentavos);
  const schedule = normalizeIncomeSchedule({
    frequency: input.frequency,
    paydayDayOfMonth: input.paydayDayOfMonth ?? null,
    paydaySecondDayOfMonth: input.paydaySecondDayOfMonth ?? null,
    paydayDayOfWeek: input.paydayDayOfWeek ?? null,
  });
  assertIncomeSchedule(schedule);

  const db = await getDb();
  const id = randomUUID();
  const ts = now();
  await assertAccessibleIncomeDestinationAndCategory(db, userId, input.destinationAccountId, input.subcategoryId);
  const payload: Record<string, unknown> = {
    name: input.name,
    frequency: input.frequency,
    destination_account_id: input.destinationAccountId,
    subcategory_id: input.subcategoryId,
    expected_amount_centavos: input.expectedAmountCentavos,
    payday_day_of_month: schedule.paydayDayOfMonth,
    payday_second_day_of_month: schedule.paydaySecondDayOfMonth,
    payday_day_of_week: schedule.paydayDayOfWeek,
    next_expected_date: input.nextExpectedDate ?? null,
    is_active: input.isActive ?? true,
    notes: input.notes ?? null,
  };

  let result: { source: IncomeSource; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const recurringTemplateId = await syncIncomeSourceRecurringTemplate(db, userId, deviceId, {
      id,
      recurringTemplateId: null,
      name: input.name,
      ...schedule,
      destinationAccountId: input.destinationAccountId,
      subcategoryId: input.subcategoryId,
      expectedAmountCentavos: input.expectedAmountCentavos,
      nextExpectedDate: input.nextExpectedDate ?? null,
      notes: input.notes ?? null,
    });

    payload.recurring_template_id = recurringTemplateId;
    await db.runAsync(
      `INSERT INTO income_sources
        (id, user_id, recurring_template_id, destination_account_id, subcategory_id, name, frequency, expected_amount_centavos,
          payday_day_of_month, payday_second_day_of_month, payday_day_of_week,
          next_expected_date, is_active, notes, metadata, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 1, 0, ?, ?)`,
      id,
      userId,
      recurringTemplateId,
      input.destinationAccountId,
      input.subcategoryId,
      input.name,
      input.frequency,
      input.expectedAmountCentavos,
      schedule.paydayDayOfMonth,
      schedule.paydaySecondDayOfMonth,
      schedule.paydayDayOfWeek,
      input.nextExpectedDate ?? null,
      boolToInt(input.isActive ?? true),
      input.notes ?? null,
      ts,
      ts,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "income_sources",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: Object.keys(payload),
      payload,
      failureMessage: `This income source "${input.name}" could not be created.`,
    });

    const row = await db.getFirstAsync<IncomeSourceRow>(
      "SELECT * FROM income_sources WHERE id = ?",
      id,
    );
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read created income source");
    result = { source: mapIncomeSource(row), operation };
  });

  return result!;
}

export async function updateIncomeSource(
  userId: string,
  deviceId: string,
  id: string,
  input: UpdateIncomeSourceInput,
): Promise<{ source: IncomeSource; operation: SyncOperation }> {
  if (input.expectedAmountCentavos !== undefined) assertIncomeAmount(input.expectedAmountCentavos);

  const db = await getDb();
  const ts = now();
  const changedFields: string[] = [];
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) { changedFields.push("name"); payload.name = input.name; }
  if (input.frequency !== undefined) { changedFields.push("frequency"); payload.frequency = input.frequency; }
  if (input.recurringTemplateId !== undefined) { changedFields.push("recurring_template_id"); payload.recurring_template_id = input.recurringTemplateId; }
  if (input.destinationAccountId !== undefined) { changedFields.push("destination_account_id"); payload.destination_account_id = input.destinationAccountId; }
  if (input.subcategoryId !== undefined) { changedFields.push("subcategory_id"); payload.subcategory_id = input.subcategoryId; }
  if (input.expectedAmountCentavos !== undefined) { changedFields.push("expected_amount_centavos"); payload.expected_amount_centavos = input.expectedAmountCentavos; }
  // The payday fields are written together once the existing schedule is known.
  const scheduleChanged = input.frequency !== undefined || input.paydayDayOfMonth !== undefined || input.paydaySecondDayOfMonth !== undefined || input.paydayDayOfWeek !== undefined;
  if (scheduleChanged) changedFields.push("payday_day_of_month", "payday_second_day_of_month", "payday_day_of_week");
  if (input.nextExpectedDate !== undefined) { changedFields.push("next_expected_date"); payload.next_expected_date = input.nextExpectedDate; }
  if (input.isActive !== undefined) { changedFields.push("is_active"); payload.is_active = input.isActive; }
  if (input.notes !== undefined) { changedFields.push("notes"); payload.notes = input.notes; }

  if (changedFields.length === 0) {
    const existing = await getIncomeSource(userId, id);
    if (!existing) throw new LocalDbError("NOT_FOUND", "income source not found");
    // ponytail: returning without operation when nothing changed, caller treats operation as potentially null
    return { source: existing, operation: null as unknown as SyncOperation };
  }

  let result: { source: IncomeSource; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<IncomeSourceRow>(
      "SELECT * FROM income_sources WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!existing) throw new LocalDbError("NOT_FOUND", "income source not found");

    const schedule = normalizeIncomeSchedule({
      frequency: (input.frequency ?? existing.frequency) as IncomeFrequency,
      paydayDayOfMonth: input.paydayDayOfMonth !== undefined ? input.paydayDayOfMonth : existing.payday_day_of_month,
      paydaySecondDayOfMonth: input.paydaySecondDayOfMonth !== undefined ? input.paydaySecondDayOfMonth : existing.payday_second_day_of_month,
      paydayDayOfWeek: input.paydayDayOfWeek !== undefined ? input.paydayDayOfWeek : existing.payday_day_of_week,
    });
    assertIncomeSchedule(schedule);
    if (scheduleChanged) {
      payload.payday_day_of_month = schedule.paydayDayOfMonth;
      payload.payday_second_day_of_month = schedule.paydaySecondDayOfMonth;
      payload.payday_day_of_week = schedule.paydayDayOfWeek;
    }
    const effectiveDestinationAccountId = input.destinationAccountId !== undefined ? input.destinationAccountId : existing.destination_account_id;
    const effectiveSubcategoryId = input.subcategoryId !== undefined ? input.subcategoryId : existing.subcategory_id;
    if (!effectiveDestinationAccountId || !effectiveSubcategoryId) {
      throw new LocalDbError("VALIDATION_ERROR", "destinationAccountId and subcategoryId are required");
    }
    await assertAccessibleIncomeDestinationAndCategory(db, userId, effectiveDestinationAccountId, effectiveSubcategoryId);

    const recurringTemplateId = await syncIncomeSourceRecurringTemplate(db, userId, deviceId, {
      id,
      recurringTemplateId: existing.recurring_template_id,
      name: input.name ?? existing.name,
      ...schedule,
      destinationAccountId: effectiveDestinationAccountId,
      subcategoryId: effectiveSubcategoryId,
      expectedAmountCentavos: input.expectedAmountCentavos ?? existing.expected_amount_centavos,
      nextExpectedDate: input.nextExpectedDate !== undefined ? input.nextExpectedDate : existing.next_expected_date,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    });
    if (existing.recurring_template_id !== recurringTemplateId) {
      changedFields.push("recurring_template_id");
      payload.recurring_template_id = recurringTemplateId;
    }

    const setClauses: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];

    if (input.name !== undefined) { setClauses.push("name = ?"); params.push(input.name); }
    if (input.frequency !== undefined) { setClauses.push("frequency = ?"); params.push(input.frequency); }
    if (input.destinationAccountId !== undefined) { setClauses.push("destination_account_id = ?"); params.push(input.destinationAccountId); }
    if (input.subcategoryId !== undefined) { setClauses.push("subcategory_id = ?"); params.push(input.subcategoryId); }
    if (input.expectedAmountCentavos !== undefined) { setClauses.push("expected_amount_centavos = ?"); params.push(input.expectedAmountCentavos); }
    if (scheduleChanged) {
      setClauses.push("payday_day_of_month = ?", "payday_second_day_of_month = ?", "payday_day_of_week = ?");
      params.push(schedule.paydayDayOfMonth, schedule.paydaySecondDayOfMonth, schedule.paydayDayOfWeek);
    }
    if (input.nextExpectedDate !== undefined) { setClauses.push("next_expected_date = ?"); params.push(input.nextExpectedDate); }
    if (input.isActive !== undefined) { setClauses.push("is_active = ?"); params.push(boolToInt(input.isActive)); }
    if (input.notes !== undefined) { setClauses.push("notes = ?"); params.push(input.notes); }
    setClauses.push("recurring_template_id = ?"); params.push(recurringTemplateId);

    setClauses.push("updated_at = ?"); params.push(ts);
    setClauses.push("version = version + 1");
    params.push(id, userId);

    await db.runAsync(
      `UPDATE income_sources SET ${setClauses.join(", ")} WHERE id = ? AND user_id = ?`,
      ...params,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "income_sources",
      recordId: id,
      operationType: "update",
      baseVersion: existing.version,
      changedFields,
      payload,
      failureMessage: `This income source "${existing.name}" could not be updated.`,
    });

    const row = await db.getFirstAsync<IncomeSourceRow>(
      "SELECT * FROM income_sources WHERE id = ?",
      id,
    );
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read updated income source");
    result = { source: mapIncomeSource(row), operation };
  });

  return result!;
}

export async function deleteIncomeSource(
  userId: string,
  deviceId: string,
  id: string,
): Promise<{ source: IncomeSource; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { source: IncomeSource; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<IncomeSourceRow>(
      "SELECT * FROM income_sources WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!existing) throw new LocalDbError("NOT_FOUND", "income source not found");

    if (existing.recurring_template_id) {
      const { deleteRecurringTemplate } = await import("../ledger/recurringTransactions");
      await deleteRecurringTemplate(userId, deviceId, existing.recurring_template_id, db);
    }

    await db.runAsync(
      `UPDATE income_sources
       SET deleted = 1, is_active = 0, updated_at = ?, version = version + 1
       WHERE id = ? AND user_id = ?`,
      ts,
      id,
      userId,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "income_sources",
      recordId: id,
      operationType: "delete",
      baseVersion: existing.version,
      changedFields: [],
      payload: {},
      failureMessage: `This income source "${existing.name}" could not be deleted.`,
    });

    const row = await db.getFirstAsync<IncomeSourceRow>(
      "SELECT * FROM income_sources WHERE id = ?",
      id,
    );
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read deleted income source");
    result = { source: mapIncomeSource(row), operation };
  });

  return result!;
}
