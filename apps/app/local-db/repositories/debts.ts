import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";
import { createExpenseInTransaction } from "./ledger";
import { validatePresetData } from "../../features/debt-manager/presets";

export type Debt = {
  id: string; userId: string; name: string; lenderName: string | null; presetKey: string;
  version: number;
  status: string; originalBalanceMinor: number; currentBalanceMinor: number;
   paidOffAt: string | null; archivedAt: string | null;
  annualInterestRateBps: number; minimumPaymentMinor: number; paymentFrequency: string;
  nextDueDate: string | null; maturityDate: string | null; targetPayoffDate: string | null;
  lastPaymentDate: string | null;
  interestPeriod: string | null; interestMethod: string | null; presetData: Record<string, unknown>; notes: string | null;
  paymentSchedule: DebtPaymentSchedule;
};
export type DebtPaymentSchedule = {
  intervalCount: string; dayOfMonth: string; secondDayOfMonth: string;
  dayOfWeek: number | null; secondDayOfWeek: number | null; monthOfYear: number | null;
  estimatedIntervalDays?: string;
  timeOfDay?: string;
};
export type CreateDebtInput = {
  name: string; lenderName: string | null; presetKey: string; originalBalanceMinor: number; currentBalanceMinor?: number;
  annualInterestRateBps: number; minimumPaymentMinor: number; paymentFrequency: string; nextDueDate: string | null;
  maturityDate: string | null; targetPayoffDate: string | null; interestPeriod: string | null; interestMethod: string | null;
  presetData: Record<string, unknown>; paymentSchedule: DebtPaymentSchedule; notes: string | null;
};
export type DebtPayment = { id: string; debtAccountId: string; transactionId: string | null; source: string; paymentDate: string; amountMinor: number; principalMinor: number | null; interestMinor: number | null; notes: string | null };
export type DebtOverview = { totalPaidMinor: number; totalOriginalMinor: number; totalRemainingMinor: number; monthlyPayments: Array<{ month: string; amountMinor: number }> };

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const getDb = () => (dbPromise ??= initDatabase());

function mapDebt(row: Record<string, any>): Debt {
  let presetData: Record<string, unknown> = {};
  let paymentSchedule: DebtPaymentSchedule = { intervalCount: "1", dayOfMonth: "", secondDayOfMonth: "", dayOfWeek: null, secondDayOfWeek: null, monthOfYear: null };
  try { presetData = JSON.parse(row.preset_data || "{}"); } catch { /* malformed remote data keeps common fields readable */ }
  try { paymentSchedule = { ...paymentSchedule, ...JSON.parse(row.payment_schedule || "{}") }; } catch { /* malformed schedule keeps common fields readable */ }
  return { id: row.id, userId: row.user_id, name: row.name, lenderName: row.lender_name, presetKey: row.preset_key, version: row.version, status: row.status, paidOffAt: row.paid_off_at ?? null, archivedAt: row.archived_at ?? null, originalBalanceMinor: row.original_balance_centavos, currentBalanceMinor: row.current_balance_centavos, annualInterestRateBps: row.annual_interest_rate_bps, minimumPaymentMinor: row.minimum_payment_centavos, paymentFrequency: row.payment_frequency, nextDueDate: row.next_due_date, maturityDate: row.maturity_date, targetPayoffDate: row.target_payoff_date, lastPaymentDate: row.last_payment_date ?? null, interestPeriod: row.interest_period, interestMethod: row.interest_method, presetData, paymentSchedule, notes: row.notes };
}

function validate(input: CreateDebtInput): void {
  if (!input.name.trim()) throw new LocalDbError("VALIDATION_ERROR", "name is required");
  for (const field of ["originalBalanceMinor", "currentBalanceMinor", "annualInterestRateBps", "minimumPaymentMinor"] as const) {
    const value = input[field] ?? 0;
    if (!Number.isInteger(value) || value < 0) throw new LocalDbError("VALIDATION_ERROR", `${field} must be a non-negative integer`);
  }
  if (!/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(input.presetKey)) throw new LocalDbError("VALIDATION_ERROR", "presetKey must be a safe slug");
  if (!input.presetData || Array.isArray(input.presetData)) throw new LocalDbError("VALIDATION_ERROR", "presetData must be an object");
  try { validatePresetData(input.presetKey, input.presetData); } catch (error) { throw new LocalDbError("VALIDATION_ERROR", error instanceof Error ? error.message : "presetData is invalid"); }
  if (!["daily", "weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly", "custom"].includes(input.paymentFrequency)) throw new LocalDbError("VALIDATION_ERROR", "paymentFrequency is invalid");
  if (input.interestPeriod !== null && input.interestPeriod !== undefined && !["daily", "monthly", "annual"].includes(input.interestPeriod)) throw new LocalDbError("VALIDATION_ERROR", "interestPeriod is invalid");
  if (input.interestMethod !== null && input.interestMethod !== undefined && !["flat_add_on", "diminishing_balance", "provider_calculated", "no_interest", "simple", "amortized", "compound"].includes(input.interestMethod)) throw new LocalDbError("VALIDATION_ERROR", "interestMethod is invalid");
  for (const [field, value] of [["nextDueDate", input.nextDueDate], ["maturityDate", input.maturityDate], ["targetPayoffDate", input.targetPayoffDate]] as const) {
    if (value !== null && value !== undefined) {
      const parsed = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new LocalDbError("VALIDATION_ERROR", `${field} must be a valid YYYY-MM-DD date`);
    }
  }
}

function validateDateOnly(value: string, field: string): void {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new LocalDbError("VALIDATION_ERROR", `${field} must be a valid YYYY-MM-DD date`);
  }
}

export async function listDebts(userId: string): Promise<Debt[]> {
  const rows = await (await getDb()).getAllAsync<Record<string, any>>("SELECT debt_accounts.*, (SELECT MAX(payment_date) FROM debt_payments WHERE debt_account_id = debt_accounts.id AND user_id = debt_accounts.user_id AND deleted = 0) AS last_payment_date FROM debt_accounts WHERE user_id = ? AND deleted = 0 AND status <> 'deleted' ORDER BY name", userId);
  return rows.map(mapDebt);
}
export async function getDebt(userId: string, id: string): Promise<Debt | null> {
  const row = await (await getDb()).getFirstAsync<Record<string, any>>("SELECT * FROM debt_accounts WHERE user_id = ? AND id = ? AND deleted = 0", userId, id);
  return row ? mapDebt(row) : null;
}

async function saveDebt(userId: string, deviceId: string, id: string, input: CreateDebtInput, type: "create" | "update", baseVersion: number | null): Promise<{ debt: Debt; operation: SyncOperation }> {
  validate(input); const db = await getDb(); const now = new Date().toISOString();
  let result!: { debt: Debt; operation: SyncOperation };
  await db.withTransactionAsync(async () => {
    const current = type === "update" ? await db.getFirstAsync<{ version: number }>("SELECT version FROM debt_accounts WHERE user_id = ? AND id = ? AND deleted = 0", userId, id) : null;
    if (type === "update" && !current) throw new LocalDbError("NOT_FOUND", "Debt not found");
    const values = [input.name, input.lenderName, input.presetKey, input.originalBalanceMinor, input.currentBalanceMinor ?? input.originalBalanceMinor, input.annualInterestRateBps, input.minimumPaymentMinor, input.paymentFrequency, input.nextDueDate, input.maturityDate, input.targetPayoffDate, input.interestPeriod, input.interestMethod, JSON.stringify(input.presetData), JSON.stringify(input.paymentSchedule), input.notes];
    if (type === "create") {
      await db.runAsync(`INSERT INTO debt_accounts (id,user_id,name,lender_name,preset_key,original_balance_centavos,current_balance_centavos,annual_interest_rate_bps,minimum_payment_centavos,payment_frequency,next_due_date,maturity_date,target_payoff_date,interest_period,interest_method,preset_data,payment_schedule,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, userId, ...values, now, now);
    } else {
      await db.runAsync(`UPDATE debt_accounts SET name=?,lender_name=?,preset_key=?,original_balance_centavos=?,current_balance_centavos=?,annual_interest_rate_bps=?,minimum_payment_centavos=?,payment_frequency=?,next_due_date=?,maturity_date=?,target_payoff_date=?,interest_period=?,interest_method=?,preset_data=?,payment_schedule=?,notes=?,version=version+1,updated_at=? WHERE user_id=? AND id=?`, ...values, now, userId, id);
    }
    const payload = {
      id,
      user_id: userId,
      name: input.name,
      lender_name: input.lenderName,
      preset_key: input.presetKey,
      original_balance_centavos: input.originalBalanceMinor,
      current_balance_centavos: input.currentBalanceMinor ?? input.originalBalanceMinor,
      annual_interest_rate_bps: input.annualInterestRateBps,
      minimum_payment_centavos: input.minimumPaymentMinor,
      payment_frequency: input.paymentFrequency,
      next_due_date: input.nextDueDate,
      maturity_date: input.maturityDate,
      target_payoff_date: input.targetPayoffDate,
      interest_period: input.interestPeriod,
      interest_method: input.interestMethod,
       preset_data: input.presetData,
       payment_schedule: input.paymentSchedule,
      notes: input.notes,
    };
    const changedFields = type === "update" ? Object.keys(payload).filter((field) => field !== "id" && field !== "user_id") : [];
    const operation = await enqueueOperation(db, { userId, deviceId, entity: "debt_accounts", recordId: id, operationType: type, baseVersion: type === "update" ? current!.version : baseVersion, changedFields, payload, failureMessage: `This debt could not be ${type === "create" ? "created" : "updated"}.` });
    result = { debt: mapDebt((await db.getFirstAsync<Record<string, any>>("SELECT * FROM debt_accounts WHERE user_id = ? AND id = ?", userId, id))!), operation };
  });
  return result;
}

export function createDebt(userId: string, deviceId: string, input: CreateDebtInput) { return saveDebt(userId, deviceId, randomUUID(), input, "create", null); }
export async function updateDebt(userId: string, deviceId: string, id: string, input: CreateDebtInput) {
  return saveDebt(userId, deviceId, id, input, "update", null);
}

export async function updateDebtStatus(userId: string, deviceId: string, id: string, status: "active" | "archived" | "paid_off"): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const now = new Date().toISOString();
     const debt = await db.getFirstAsync<{ version: number; current_balance_centavos: number }>("SELECT version,current_balance_centavos FROM debt_accounts WHERE user_id=? AND id=? AND deleted=0", userId, id);
     if (!debt) throw new LocalDbError("NOT_FOUND", "Debt not found");
     if (status === "paid_off" && debt.current_balance_centavos !== 0) throw new LocalDbError("VALIDATION_ERROR", "paid_off status requires a zero balance");
     await db.runAsync("UPDATE debt_accounts SET status=?,paid_off_at=CASE WHEN ?='paid_off' THEN COALESCE(paid_off_at,?) ELSE NULL END,archived_at=CASE WHEN ?='archived' THEN COALESCE(archived_at,?) ELSE NULL END,version=version+1,updated_at=? WHERE user_id=? AND id=? AND deleted=0", status, status, now, status, now, now, userId, id);
     await enqueueOperation(db, { userId, deviceId, entity: "debt_accounts", recordId: id, operationType: "update", baseVersion: debt.version, changedFields: ["status", "archived_at"], payload: { id, user_id: userId, status, archived_at: status === "archived" ? now : null }, failureMessage: "This debt status could not be saved." });
  });
}
export async function deleteDebt(userId: string, deviceId: string, id: string, confirmed: boolean) {
  if (!confirmed) throw new LocalDbError("VALIDATION_ERROR", "Debt deletion requires confirmation");
  const db = await getDb(); const row = await db.getFirstAsync<{ version: number }>("SELECT version FROM debt_accounts WHERE user_id = ? AND id = ? AND deleted = 0", userId, id);
  if (!row) throw new LocalDbError("NOT_FOUND", "Debt not found");
  let operation!: SyncOperation;
  await db.withTransactionAsync(async () => { await db.runAsync("UPDATE debt_accounts SET status='deleted',deleted=1,version=version+1,updated_at=? WHERE user_id=? AND id=?", new Date().toISOString(), userId, id); operation = await enqueueOperation(db, { userId, deviceId, entity: "debt_accounts", recordId: id, operationType: "delete", baseVersion: row.version, changedFields: [], payload: { id }, failureMessage: "This debt could not be deleted." }); });
  return { operation };
}

export async function listDebtPayments(userId: string, debtAccountId: string): Promise<DebtPayment[]> {
  const db = await getDb(); const rows = await db.getAllAsync<Record<string, any>>("SELECT id,debt_account_id,transaction_id,source,payment_date,amount_centavos,principal_centavos,interest_centavos,notes FROM debt_payments WHERE user_id=? AND debt_account_id=? AND deleted=0 ORDER BY payment_date DESC", userId, debtAccountId);
  return rows.map((row) => ({ id: row.id, debtAccountId: row.debt_account_id, transactionId: row.transaction_id, source: row.source, paymentDate: row.payment_date, amountMinor: row.amount_centavos, principalMinor: row.principal_centavos, interestMinor: row.interest_centavos, notes: row.notes }));
}
export async function listCurrentDebtPaymentTotals(userId: string, month: string): Promise<Record<string, number>> {
  const db = await getDb(); const start = `${month}-01`; const date = new Date(`${start}T00:00:00.000Z`); date.setUTCMonth(date.getUTCMonth() + 1); const end = date.toISOString().slice(0, 10);
  const rows = await db.getAllAsync<{ debt_account_id: string; total_minor: number }>("SELECT debt_account_id,COALESCE(SUM(amount_centavos),0) AS total_minor FROM debt_payments WHERE user_id=? AND payment_date>=? AND payment_date<? AND deleted=0 GROUP BY debt_account_id", userId, start, end);
  return Object.fromEntries(rows.map((row) => [row.debt_account_id, row.total_minor]));
}
export async function getDebtOverview(userId: string): Promise<DebtOverview> {
  const db = await getDb();
  const totals = await db.getFirstAsync<{ original: number; remaining: number; paid: number }>(
    "SELECT COALESCE((SELECT SUM(original_balance_centavos) FROM debt_accounts WHERE user_id=? AND deleted=0),0) AS original,COALESCE((SELECT SUM(current_balance_centavos) FROM debt_accounts WHERE user_id=? AND deleted=0),0) AS remaining,COALESCE((SELECT SUM(amount_centavos) FROM debt_payments WHERE user_id=? AND deleted=0),0) AS paid",
    userId, userId, userId,
  );
  const monthlyPayments = await db.getAllAsync<{ month: string; amountMinor: number }>(
    "SELECT substr(payment_date,1,7) AS month,COALESCE(SUM(amount_centavos),0) AS amountMinor FROM debt_payments WHERE user_id=? AND deleted=0 GROUP BY substr(payment_date,1,7) ORDER BY month DESC LIMIT 12",
    userId,
  );
  return { totalPaidMinor: totals?.paid ?? 0, totalOriginalMinor: totals?.original ?? 0, totalRemainingMinor: totals?.remaining ?? 0, monthlyPayments };
}
export async function getDebtStrategy(userId: string): Promise<"snowball" | "avalanche"> { return (await (await getDb()).getFirstAsync<{ strategy: "snowball" | "avalanche" }>("SELECT strategy FROM debt_strategy_preferences WHERE user_id=? AND deleted=0", userId))?.strategy ?? "avalanche"; }
export async function updateDebtStrategy(userId: string, deviceId: string, strategy: "snowball" | "avalanche"): Promise<void> { const db = await getDb(); const now = new Date().toISOString(); await db.withTransactionAsync(async () => { const current = await db.getFirstAsync<{ version: number }>("SELECT version FROM debt_strategy_preferences WHERE user_id=? AND deleted=0", userId); await db.runAsync("INSERT INTO debt_strategy_preferences(user_id,strategy,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET strategy=excluded.strategy,version=version+1,updated_at=excluded.updated_at", userId, strategy, now, now); await enqueueOperation(db, { userId, deviceId, entity: "debt_strategy_preferences", recordId: userId, operationType: "update", baseVersion: current?.version ?? null, changedFields: ["strategy"], payload: { user_id: userId, strategy }, failureMessage: "Debt strategy could not be synced." }); }); }
export async function listDebtPriorities(userId: string): Promise<string[]> { const rows = await (await getDb()).getAllAsync<{ debt_account_id: string }>("SELECT p.debt_account_id FROM user_debt_priorities p JOIN debt_accounts d ON d.id=p.debt_account_id AND d.user_id=p.user_id WHERE p.user_id=? AND p.deleted=0 AND d.deleted=0 AND d.status='active' ORDER BY p.priority_rank", userId); return rows.map((row) => row.debt_account_id); }
export async function setDebtPriorities(userId: string, deviceId: string, debtIds: string[]): Promise<void> {
  const db = await getDb();
  if (new Set(debtIds).size !== debtIds.length) throw new LocalDbError("VALIDATION_ERROR", "Debt priorities cannot contain duplicates");
  let baseVersion: number | null = null;
  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<{ version: number }>("SELECT MAX(version) AS version FROM user_debt_priorities WHERE user_id=?", userId);
    baseVersion = current?.version ?? null;
    if (debtIds.length) {
      const placeholders = debtIds.map(() => "?").join(",");
      const rows = await db.getAllAsync<{ id: string }>(`SELECT id FROM debt_accounts WHERE user_id=? AND deleted=0 AND status='active' AND id IN (${placeholders})`, userId, ...debtIds);
      if (rows.length !== debtIds.length) throw new LocalDbError("VALIDATION_ERROR", "Debt priority is not accessible");
    }
    await db.runAsync("DELETE FROM user_debt_priorities WHERE user_id=?", userId);
    if (debtIds.length) {
      const now = new Date().toISOString();
      const rows = debtIds.map(() => "(?,?,?,?,?,?)").join(",");
      // The debt account is the stable identity of a priority row; row UUIDs
      // make pull convergence treat the same debt as multiple priorities.
      const values = debtIds.flatMap((id, index) => [id, userId, id, index + 1, now, now]);
      await db.runAsync(`INSERT INTO user_debt_priorities(id,user_id,debt_account_id,priority_rank,created_at,updated_at) VALUES ${rows}`, ...values);
    }
    await enqueueOperation(db, { userId, deviceId, entity: "user_debt_priorities", recordId: userId, operationType: "update", baseVersion, changedFields: ["priorities"], payload: { user_id: userId, priorities: debtIds }, failureMessage: "Debt priorities could not be synced." });
  });
}

function validatePaymentInput(debt: Debt, input: { amountMinor: number; paymentDate: string; principalMinor?: number; interestMinor?: number }): void {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0 || input.amountMinor > debt.currentBalanceMinor) throw new LocalDbError("VALIDATION_ERROR", "Payment must be a positive amount no greater than the debt balance");
  validateDateOnly(input.paymentDate, "paymentDate");
  for (const [label, value] of [["principal", input.principalMinor], ["interest", input.interestMinor]] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > input.amountMinor)) throw new LocalDbError("VALIDATION_ERROR", `${label} must be a non-negative amount no greater than the payment`);
  }
  if ((input.principalMinor ?? 0) + (input.interestMinor ?? 0) > input.amountMinor) throw new LocalDbError("VALIDATION_ERROR", "Principal and interest cannot exceed the payment");
}

export async function createDebtPaymentExpense(userId: string, deviceId: string, debtAccountId: string, input: { amountMinor: number; sourceAccountId: string; paymentDate: string; subcategoryId: string; notes?: string }) {
  const debt = await getDebt(userId, debtAccountId); if (!debt || debt.status !== "active") throw new LocalDbError("NOT_FOUND", "Debt not found");
  validatePaymentInput(debt, input);
  if (!input.sourceAccountId.trim() || !input.subcategoryId.trim()) throw new LocalDbError("VALIDATION_ERROR", "Payment account and subcategory are required");
  validateDateOnly(input.paymentDate, "paymentDate");
  const db = await getDb();
  const source = await db.getFirstAsync<{ id: string }>("SELECT id FROM financial_accounts WHERE id=? AND user_id=? AND status='active' AND deleted=0 AND kind<>'credit_card'", input.sourceAccountId, userId);
  if (!source) throw new LocalDbError("VALIDATION_ERROR", "Payment source account must be an active non-credit-card account");
  const paymentId = randomUUID(); const now = new Date().toISOString(); let transaction!: Awaited<ReturnType<typeof createExpenseInTransaction>>;
  await db.withTransactionAsync(async () => {
    transaction = await createExpenseInTransaction(db, userId, deviceId, { amount_centavos: input.amountMinor, source_account_id: input.sourceAccountId, subcategory_id: input.subcategoryId, transaction_date: input.paymentDate, notes: input.notes, client_mutation_id: `debt-payment:${paymentId}` });
    const balanceUpdate = await db.runAsync("UPDATE debt_accounts SET current_balance_centavos=current_balance_centavos-?,status=CASE WHEN current_balance_centavos-?=0 THEN 'paid_off' ELSE status END,paid_off_at=CASE WHEN current_balance_centavos-?=0 THEN COALESCE(paid_off_at,?) ELSE paid_off_at END,updated_at=?,version=version+1 WHERE user_id=? AND id=? AND deleted=0 AND current_balance_centavos>=?", input.amountMinor, input.amountMinor, input.amountMinor, now, now, userId, debtAccountId, input.amountMinor);
    if (balanceUpdate.changes !== 1) throw new LocalDbError("VALIDATION_ERROR", "Payment exceeds the current debt balance");
    await db.runAsync("INSERT INTO debt_payments(id,debt_account_id,user_id,transaction_id,source,payment_date,amount_centavos,principal_centavos,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", paymentId, debtAccountId, userId, transaction.transaction.id, "transaction", input.paymentDate, input.amountMinor, input.amountMinor, now, now);
    await enqueueOperation(db, { userId, deviceId, entity: "debt_payments", recordId: paymentId, operationType: "create", baseVersion: null, changedFields: [], payload: { id: paymentId, user_id: userId, debt_account_id: debtAccountId, transaction_id: transaction.transaction.id, linked_transaction_type: "expense", linked_source_account_id: input.sourceAccountId, linked_subcategory_id: input.subcategoryId, source: "transaction", payment_date: input.paymentDate, amount_centavos: input.amountMinor, principal_centavos: input.amountMinor, notes: input.notes ?? null }, failureMessage: "This debt payment and transaction could not be synced." });
  });
  return { transaction: transaction.transaction, paymentId };
}

export async function createDebtPayment(userId: string, deviceId: string, debtAccountId: string, input: { amountMinor: number; paymentDate: string; principalMinor?: number; interestMinor?: number; notes?: string }) {
  const debt = await getDebt(userId, debtAccountId); if (!debt || debt.status !== "active") throw new LocalDbError("NOT_FOUND", "Debt not found");
  validatePaymentInput(debt, input);
  const db = await getDb(); const paymentId = randomUUID(); const now = new Date().toISOString();
  const principalMinor = input.principalMinor ?? input.amountMinor;
  await db.withTransactionAsync(async () => {
    const balanceUpdate = await db.runAsync("UPDATE debt_accounts SET current_balance_centavos=current_balance_centavos-?,status=CASE WHEN current_balance_centavos-?=0 THEN 'paid_off' ELSE status END,paid_off_at=CASE WHEN current_balance_centavos-?=0 THEN COALESCE(paid_off_at,?) ELSE paid_off_at END,updated_at=?,version=version+1 WHERE user_id=? AND id=? AND deleted=0 AND current_balance_centavos>=?", principalMinor, principalMinor, principalMinor, now, now, userId, debtAccountId, principalMinor);
    if (balanceUpdate.changes !== 1) throw new LocalDbError("VALIDATION_ERROR", "Payment exceeds the current debt balance");
    await db.runAsync("INSERT INTO debt_payments(id,debt_account_id,user_id,transaction_id,source,payment_date,amount_centavos,principal_centavos,interest_centavos,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", paymentId, debtAccountId, userId, null, "manual", input.paymentDate, input.amountMinor, principalMinor, input.interestMinor ?? null, input.notes ?? null, now, now);
    await enqueueOperation(db, { userId, deviceId, entity: "debt_payments", recordId: paymentId, operationType: "create", baseVersion: null, changedFields: [], payload: { id: paymentId, user_id: userId, debt_account_id: debtAccountId, transaction_id: null, source: "manual", payment_date: input.paymentDate, amount_centavos: input.amountMinor, principal_centavos: principalMinor, interest_centavos: input.interestMinor ?? null, notes: input.notes ?? null }, failureMessage: "This debt payment could not be synced." });
  });
  return { paymentId };
}

export async function linkDebtPaymentToTransaction(userId: string, deviceId: string, paymentId: string, input: { sourceAccountId: string; subcategoryId: string; paymentDate: string; notes?: string }) {
  validateDateOnly(input.paymentDate, "paymentDate");
  const db = await getDb();
  let transaction!: Awaited<ReturnType<typeof createExpenseInTransaction>>;
  await db.withTransactionAsync(async () => {
  const payment = await db.getFirstAsync<{ debt_account_id: string; transaction_id: string | null; amount_centavos: number; interest_centavos: number | null; version: number }>("SELECT debt_account_id,transaction_id,amount_centavos,interest_centavos,version FROM debt_payments WHERE user_id=? AND id=? AND deleted=0", userId, paymentId);
    if (!payment) throw new LocalDbError("NOT_FOUND", "Debt payment not found");
    if (payment.transaction_id) throw new LocalDbError("VALIDATION_ERROR", "Debt payment is already linked");
    const source = await db.getFirstAsync<{ id: string }>("SELECT id FROM financial_accounts WHERE id=? AND user_id=? AND status='active' AND deleted=0 AND kind<>'credit_card'", input.sourceAccountId, userId);
    if (!source) throw new LocalDbError("VALIDATION_ERROR", "Payment source account must be an active non-credit-card account");
    transaction = await createExpenseInTransaction(db, userId, deviceId, { amount_centavos: payment.amount_centavos, source_account_id: input.sourceAccountId, subcategory_id: input.subcategoryId, transaction_date: input.paymentDate, notes: input.notes, client_mutation_id: `debt-payment:${paymentId}` });
    await db.runAsync("UPDATE debt_payments SET transaction_id=?,source='transaction',payment_date=?,version=version+1,updated_at=? WHERE user_id=? AND id=? AND transaction_id IS NULL", transaction.transaction.id, input.paymentDate, new Date().toISOString(), userId, paymentId);
    const payload = { id: paymentId, user_id: userId, debt_account_id: payment.debt_account_id, transaction_id: transaction.transaction.id, linked_transaction_type: "expense", linked_source_account_id: input.sourceAccountId, linked_subcategory_id: input.subcategoryId, source: "transaction", payment_date: input.paymentDate, amount_centavos: payment.amount_centavos, principal_centavos: payment.amount_centavos - (payment.interest_centavos ?? 0), interest_centavos: payment.interest_centavos, notes: input.notes ?? null };
    const pending = await db.getFirstAsync<{ operation_id: string }>("SELECT operation_id FROM sync_queue WHERE entity='debt_payments' AND record_id=? AND user_id=? AND status='pending'", paymentId, userId);
    if (pending) {
      await db.runAsync("UPDATE sync_queue SET payload=?,changed_fields=? WHERE operation_id=? AND status='pending'", JSON.stringify(payload), JSON.stringify(Object.keys(payload).filter((field) => !["id", "user_id"].includes(field))), pending.operation_id);
    } else {
      await enqueueOperation(db, { userId, deviceId, entity: "debt_payments", recordId: paymentId, operationType: "update", baseVersion: payment.version, changedFields: ["debt_account_id", "transaction_id", "linked_transaction_type", "linked_source_account_id", "linked_subcategory_id", "source", "payment_date", "amount_centavos", "principal_centavos", "interest_centavos", "notes"], payload, failureMessage: "This debt payment link could not be synced." });
    }
  });
  return transaction.transaction;
}
