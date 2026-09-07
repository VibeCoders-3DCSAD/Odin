import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import { randomUUID } from "../uuid";
import type { SyncOperation } from "../types";
import {
  calculateCurrentCreditCardCycle,
  calculateSuccessorCreditCardCycle,
  validateCreditCardCycleDates,
  validateIsoDate,
} from "./creditCardCycleDates";

export type CreditCardCycle = {
  id: string;
  user_id: string;
  account_id: string;
  cycle_start_date: string;
  cutoff_date: string;
  statement_date: string | null;
  version: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type CreditCardCycleTransaction = {
  transaction_id: string;
  account_id: string;
  cycle_id: string;
  purchase_type: "regular" | "installment";
  transaction_date: string;
  merchant_name: string | null;
  amount_centavos: number;
};

type CycleRow = Omit<CreditCardCycle, "deleted"> & { deleted: number };

export type CreditCardCycleDefaults = {
  account_id: string;
  cutoff_day: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function now(): string {
  return new Date().toISOString();
}

function mapCycle(row: CycleRow): CreditCardCycle {
  return { ...row, deleted: row.deleted === 1 };
}

function cyclePayload(cycle: Pick<CreditCardCycle, "account_id" | "cycle_start_date" | "cutoff_date">) {
  return {
    account_id: cycle.account_id,
    cycle_start_date: cycle.cycle_start_date,
    cutoff_date: cycle.cutoff_date,
  };
}

export async function listCreditCardCycles(userId: string, accountId?: string): Promise<CreditCardCycle[]> {
  const db = await getDb();
  const rows = accountId
    ? await db.getAllAsync<CycleRow>(
        "SELECT * FROM credit_card_cycles WHERE user_id = ? AND account_id = ? AND deleted = 0 ORDER BY cutoff_date DESC",
        userId,
        accountId,
      )
    : await db.getAllAsync<CycleRow>(
        "SELECT * FROM credit_card_cycles WHERE user_id = ? AND deleted = 0 ORDER BY cutoff_date DESC",
        userId,
      );
  return rows.map(mapCycle);
}

export async function getCurrentCreditCardCycle(
  userId: string,
  accountId: string,
  asOfDate = new Date().toISOString().slice(0, 10),
): Promise<CreditCardCycle | null> {
  validateIsoDate(asOfDate, "asOfDate");
  const db = await getDb();
  const row = await db.getFirstAsync<CycleRow>(
    `SELECT * FROM credit_card_cycles
      WHERE user_id = ? AND account_id = ? AND deleted = 0
        AND cycle_start_date <= ? AND cutoff_date >= ?
      ORDER BY cycle_start_date DESC, cutoff_date DESC LIMIT 1`,
    userId,
    accountId,
    asOfDate,
    asOfDate,
  );
  return row ? mapCycle(row) : null;
}

export async function resolveCreditCardCycle(
  userId: string,
  deviceId: string,
  accountId: string,
  effectiveDate: string,
): Promise<CreditCardCycle> {
  validateIsoDate(effectiveDate, "effectiveDate");
  await ensureCurrentCreditCardCycles(userId, deviceId, effectiveDate);
  const cycle = await getCurrentCreditCardCycle(userId, accountId, effectiveDate);
  if (!cycle) {
    throw new LocalDbError(
      "CREDIT_CARD_TRANSACTION_UNAVAILABLE",
      "Credit-card transactions cannot be recorded until billing-cycle routing is available.",
    );
  }
  return cycle;
}

export async function listCreditCardCycleTransactions(
  userId: string,
  cycleId?: string,
): Promise<CreditCardCycleTransaction[]> {
  const db = await getDb();
  const sql = `SELECT cct.transaction_id, cct.account_id, cct.cycle_id, cct.purchase_type,
            t.transaction_date, t.merchant_name, t.amount_centavos
       FROM credit_card_transactions cct
       JOIN transactions t ON t.id = cct.transaction_id AND t.user_id = cct.user_id AND t.deleted = 0
      WHERE cct.user_id = ? AND cct.deleted = 0
        ${cycleId ? "AND cct.cycle_id = ?" : ""}
      ORDER BY t.transaction_date DESC, t.created_at DESC`;
  return cycleId
    ? db.getAllAsync<CreditCardCycleTransaction>(sql, userId, cycleId)
    : db.getAllAsync<CreditCardCycleTransaction>(sql, userId);
}

export async function createCreditCardCycle(
  userId: string,
  deviceId: string,
  input: Pick<CreditCardCycle, "account_id" | "cycle_start_date" | "cutoff_date">,
): Promise<{ cycle: CreditCardCycle; operation: SyncOperation }> {
  validateCreditCardCycleDates(input);
  const db = await getDb();
  const id = randomUUID();
  const ts = now();
  let result!: { cycle: CreditCardCycle; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const account = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM financial_accounts WHERE id = ? AND user_id = ? AND kind = 'credit_card' AND status = 'active' AND deleted = 0",
      input.account_id,
      userId,
    );
    if (!account) throw new LocalDbError("NOT_FOUND", "Credit card account not found");

    await db.runAsync(
      `INSERT INTO credit_card_cycles
        (id, user_id, account_id, cycle_start_date, cutoff_date, statement_date, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      id,
      userId,
      input.account_id,
      input.cycle_start_date,
      input.cutoff_date,
       null,
      ts,
      ts,
    );
    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "credit_card_cycles",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: Object.keys(cyclePayload(input)),
      payload: cyclePayload(input),
      failureMessage: "This credit-card billing cycle could not be saved.",
    });
    const row = await db.getFirstAsync<CycleRow>("SELECT * FROM credit_card_cycles WHERE id = ? AND user_id = ?", id, userId);
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read created credit-card cycle");
    result = { cycle: mapCycle(row), operation };
  });

  return result;
}

export async function updateCreditCardCycle(
  userId: string,
  deviceId: string,
  id: string,
  input: Pick<CreditCardCycle, "cycle_start_date" | "cutoff_date">,
): Promise<{ cycle: CreditCardCycle; operation: SyncOperation }> {
  validateCreditCardCycleDates(input);
  const db = await getDb();
  const ts = now();
  let result!: { cycle: CreditCardCycle; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<CycleRow>(
      "SELECT * FROM credit_card_cycles WHERE id = ? AND user_id = ? AND deleted = 0",
      id,
      userId,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Credit card billing cycle not found");
    if (current.statement_date) {
      throw new LocalDbError("VALIDATION_ERROR", "Recorded credit-card billing cycles cannot be changed.");
    }
    const today = new Date().toISOString().slice(0, 10);
    if (today < current.cycle_start_date || today > current.cutoff_date) {
      throw new LocalDbError("VALIDATION_ERROR", "Only the open credit-card billing cycle can be changed.");
    }
    const details = await db.getFirstAsync<{ billing_cycle_days: number | null }>(
      "SELECT billing_cycle_days FROM credit_card_details WHERE account_id = ? AND user_id = ? AND deleted = 0",
      current.account_id,
      userId,
    );
    if (!details?.billing_cycle_days || details.billing_cycle_days < 1) {
      throw new LocalDbError("VALIDATION_ERROR", "A billing-cycle length is required before changing this cycle.");
    }
    const duplicate = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM credit_card_cycles
        WHERE user_id = ? AND account_id = ? AND cycle_start_date = ? AND cutoff_date = ?
          AND id != ? AND deleted = 0`,
      userId,
      current.account_id,
      input.cycle_start_date,
      input.cutoff_date,
      id,
    );
    if (duplicate) {
      throw new LocalDbError("VALIDATION_ERROR", "A billing cycle with these dates already exists.");
    }
    const futureCycles = await db.getAllAsync<CycleRow>(
      `SELECT * FROM credit_card_cycles
        WHERE user_id = ? AND account_id = ? AND id != ? AND deleted = 0
          AND cycle_start_date > ?`,
      userId,
      current.account_id,
      id,
      input.cutoff_date,
    );
    for (const future of futureCycles) {
      const protectedRecord = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM credit_card_statements WHERE user_id = ? AND cycle_id = ? AND deleted = 0
         UNION ALL SELECT transaction_id AS id FROM credit_card_transactions WHERE user_id = ? AND cycle_id = ? AND deleted = 0
         UNION ALL SELECT id FROM credit_card_payments WHERE user_id = ? AND cycle_id = ? AND deleted = 0
         LIMIT 1`,
        userId, future.id, userId, future.id, userId, future.id,
      );
      if (protectedRecord) {
        throw new LocalDbError("VALIDATION_ERROR", "This change would alter a future billing cycle with recorded activity.");
      }
    }
    for (const future of futureCycles) {
      await db.runAsync(
        "UPDATE credit_card_cycles SET deleted = 1, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?",
        ts, future.id, userId,
      );
      await enqueueOperation(db, {
        userId, deviceId, entity: "credit_card_cycles", recordId: future.id, operationType: "delete", baseVersion: future.version,
        changedFields: [], payload: {}, failureMessage: "This credit-card billing cycle could not be saved.",
      });
    }
    await db.runAsync(
      `UPDATE credit_card_cycles
          SET cycle_start_date = ?, cutoff_date = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND user_id = ? AND deleted = 0`,
      input.cycle_start_date,
      input.cutoff_date,
      ts,
      id,
      userId,
    );
    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "credit_card_cycles",
      recordId: id,
      operationType: "update",
      baseVersion: current.version,
      changedFields: ["cycle_start_date", "cutoff_date"],
      payload: { cycle_start_date: input.cycle_start_date, cutoff_date: input.cutoff_date },
      failureMessage: "This credit-card billing cycle could not be saved.",
    });
    const successor = calculateSuccessorCreditCardCycle(input.cutoff_date, details.billing_cycle_days);
    const successorId = randomUUID();
    await db.runAsync(
      `INSERT INTO credit_card_cycles
        (id, user_id, account_id, cycle_start_date, cutoff_date, statement_date, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, 1, 0, ?, ?)`,
      successorId, userId, current.account_id, successor.cycle_start_date, successor.cutoff_date, ts, ts,
    );
    await enqueueOperation(db, {
      userId, deviceId, entity: "credit_card_cycles", recordId: successorId, operationType: "create", baseVersion: null,
      changedFields: Object.keys(cyclePayload({ account_id: current.account_id, ...successor })),
      payload: cyclePayload({ account_id: current.account_id, ...successor }),
      failureMessage: "This credit-card billing cycle could not be saved.",
    });
    const row = await db.getFirstAsync<CycleRow>("SELECT * FROM credit_card_cycles WHERE id = ? AND user_id = ?", id, userId);
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "failed to read updated credit-card cycle");
    result = { cycle: mapCycle(row), operation };
  });
  return result;
}

export async function ensureCurrentCreditCardCycles(userId: string, deviceId: string, asOfDate?: string): Promise<CreditCardCycle[]> {
  const db = await getDb();
  const date = asOfDate ?? new Date().toISOString().slice(0, 10);
  validateIsoDate(date, "asOfDate");
  const rows = await db.getAllAsync<CreditCardCycleDefaults>(
    `SELECT fa.id AS account_id, cc.cutoff_day
     FROM financial_accounts fa
     JOIN credit_card_details cc ON cc.account_id = fa.id AND cc.user_id = fa.user_id AND cc.deleted = 0
     WHERE fa.user_id = ? AND fa.kind = 'credit_card' AND fa.status = 'active' AND fa.deleted = 0`,
    userId,
  );
  const ensured: CreditCardCycle[] = [];

  await db.withTransactionAsync(async () => {
    for (const defaults of rows) {
      const existingCurrent = await db.getFirstAsync<CycleRow>(
        `SELECT * FROM credit_card_cycles
          WHERE user_id = ? AND account_id = ? AND deleted = 0
            AND cycle_start_date <= ? AND cutoff_date >= ?
          ORDER BY cycle_start_date DESC LIMIT 1`,
        userId,
        defaults.account_id,
        date,
        date,
      );
      if (existingCurrent) {
        ensured.push(mapCycle(existingCurrent));
        continue;
      }
      const calculated = calculateCurrentCreditCardCycle(defaults, date);
      let row = await db.getFirstAsync<CycleRow>(
        `SELECT * FROM credit_card_cycles
           WHERE user_id = ? AND account_id = ? AND cycle_start_date = ? AND cutoff_date = ? AND deleted = 0`,
        userId,
        calculated.account_id,
        calculated.cycle_start_date,
        calculated.cutoff_date,
      );
      if (!row) {
        const id = randomUUID();
        const ts = now();
        const insertResult = await db.runAsync(
          `INSERT OR IGNORE INTO credit_card_cycles
             (id, user_id, account_id, cycle_start_date, cutoff_date, statement_date, version, deleted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
          id,
          userId,
          calculated.account_id,
          calculated.cycle_start_date,
          calculated.cutoff_date,
          calculated.statement_date,
           ts,
           ts,
         );
         if (insertResult.changes > 0) {
           await enqueueOperation(db, {
             userId,
             deviceId,
             entity: "credit_card_cycles",
             recordId: id,
             operationType: "create",
             baseVersion: null,
             changedFields: Object.keys(cyclePayload(calculated)),
             payload: cyclePayload(calculated),
             failureMessage: "This credit-card billing cycle could not be saved.",
           });
           row = await db.getFirstAsync<CycleRow>("SELECT * FROM credit_card_cycles WHERE id = ? AND user_id = ?", id, userId);
         } else {
           row = await db.getFirstAsync<CycleRow>(
             `SELECT * FROM credit_card_cycles
                WHERE user_id = ? AND account_id = ? AND cycle_start_date = ? AND deleted = 0`,
             userId,
             calculated.account_id,
             calculated.cycle_start_date,
           );
         }
      }
      if (row) ensured.push(mapCycle(row));
    }
  });

  return ensured;
}
