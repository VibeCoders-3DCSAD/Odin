import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";
import { createExpenseInTransaction } from "./ledger";

export type Debt = {
  id: string; userId: string; name: string; lenderName: string | null; presetKey: string;
  version: number;
  status: string; originalBalanceMinor: number; currentBalanceMinor: number;
  annualInterestRateBps: number; minimumPaymentMinor: number; paymentFrequency: string;
  nextDueDate: string | null; maturityDate: string | null; targetPayoffDate: string | null;
  interestPeriod: string | null; interestMethod: string | null; presetData: Record<string, unknown>; notes: string | null;
};
export type CreateDebtInput = {
  name: string; lenderName: string | null; presetKey: string; originalBalanceMinor: number; currentBalanceMinor?: number;
  annualInterestRateBps: number; minimumPaymentMinor: number; paymentFrequency: string; nextDueDate: string | null;
  maturityDate: string | null; targetPayoffDate: string | null; interestPeriod: string | null; interestMethod: string | null;
  presetData: Record<string, unknown>; notes: string | null;
};
export type DebtPayment = { id: string; debtAccountId: string; transactionId: string | null; source: string; paymentDate: string; amountMinor: number; principalMinor: number | null; interestMinor: number | null; notes: string | null };

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const getDb = () => (dbPromise ??= initDatabase());

function mapDebt(row: Record<string, any>): Debt {
  return { id: row.id, userId: row.user_id, name: row.name, lenderName: row.lender_name, presetKey: row.preset_key, version: row.version, status: row.status, originalBalanceMinor: row.original_balance_centavos, currentBalanceMinor: row.current_balance_centavos, annualInterestRateBps: row.annual_interest_rate_bps, minimumPaymentMinor: row.minimum_payment_centavos, paymentFrequency: row.payment_frequency, nextDueDate: row.next_due_date, maturityDate: row.maturity_date, targetPayoffDate: row.target_payoff_date, interestPeriod: row.interest_period, interestMethod: row.interest_method, presetData: JSON.parse(row.preset_data || "{}"), notes: row.notes };
}

function validate(input: CreateDebtInput): void {
  if (!input.name.trim()) throw new LocalDbError("VALIDATION_ERROR", "name is required");
  for (const field of ["originalBalanceMinor", "currentBalanceMinor", "annualInterestRateBps", "minimumPaymentMinor"] as const) {
    const value = input[field] ?? 0;
    if (!Number.isInteger(value) || value < 0) throw new LocalDbError("VALIDATION_ERROR", `${field} must be a non-negative integer`);
  }
  if (!/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(input.presetKey)) throw new LocalDbError("VALIDATION_ERROR", "presetKey must be a safe slug");
  if (!input.presetData || Array.isArray(input.presetData)) throw new LocalDbError("VALIDATION_ERROR", "presetData must be an object");
}

export async function listDebts(userId: string): Promise<Debt[]> {
  const rows = await (await getDb()).getAllAsync<Record<string, any>>("SELECT * FROM debt_accounts WHERE user_id = ? AND deleted = 0 AND status <> 'deleted' ORDER BY name", userId);
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
    const values = [input.name, input.lenderName, input.presetKey, input.originalBalanceMinor, input.currentBalanceMinor ?? input.originalBalanceMinor, input.annualInterestRateBps, input.minimumPaymentMinor, input.paymentFrequency, input.nextDueDate, input.maturityDate, input.targetPayoffDate, input.interestPeriod, input.interestMethod, JSON.stringify(input.presetData), input.notes];
    if (type === "create") {
      await db.runAsync(`INSERT INTO debt_accounts (id,user_id,name,lender_name,preset_key,original_balance_centavos,current_balance_centavos,annual_interest_rate_bps,minimum_payment_centavos,payment_frequency,next_due_date,maturity_date,target_payoff_date,interest_period,interest_method,preset_data,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, userId, ...values, now, now);
    } else {
      await db.runAsync(`UPDATE debt_accounts SET name=?,lender_name=?,preset_key=?,original_balance_centavos=?,current_balance_centavos=?,annual_interest_rate_bps=?,minimum_payment_centavos=?,payment_frequency=?,next_due_date=?,maturity_date=?,target_payoff_date=?,interest_period=?,interest_method=?,preset_data=?,notes=?,version=version+1,updated_at=? WHERE user_id=? AND id=?`, ...values, now, userId, id);
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
      notes: input.notes,
    };
    const operation = await enqueueOperation(db, { userId, deviceId, entity: "debt_accounts", recordId: id, operationType: type, baseVersion, changedFields: [], payload, failureMessage: `This debt could not be ${type === "create" ? "created" : "updated"}.` });
    result = { debt: mapDebt((await db.getFirstAsync<Record<string, any>>("SELECT * FROM debt_accounts WHERE user_id = ? AND id = ?", userId, id))!), operation };
  });
  return result;
}

export function createDebt(userId: string, deviceId: string, input: CreateDebtInput) { return saveDebt(userId, deviceId, randomUUID(), input, "create", null); }
export async function updateDebt(userId: string, deviceId: string, id: string, input: CreateDebtInput) {
  const row = await (await getDb()).getFirstAsync<{ version: number }>("SELECT version FROM debt_accounts WHERE user_id = ? AND id = ? AND deleted = 0", userId, id);
  if (!row) throw new LocalDbError("NOT_FOUND", "Debt not found");
  return saveDebt(userId, deviceId, id, input, "update", row.version);
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
export async function getDebtStrategy(userId: string): Promise<"snowball" | "avalanche"> { return (await (await getDb()).getFirstAsync<{ strategy: "snowball" | "avalanche" }>("SELECT strategy FROM debt_strategy_preferences WHERE user_id=? AND deleted=0", userId))?.strategy ?? "avalanche"; }
export async function updateDebtStrategy(userId: string, deviceId: string, strategy: "snowball" | "avalanche"): Promise<void> { const db = await getDb(); const now = new Date().toISOString(); await db.withTransactionAsync(async () => { await db.runAsync("INSERT INTO debt_strategy_preferences(user_id,strategy,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET strategy=excluded.strategy,version=version+1,updated_at=excluded.updated_at", userId, strategy, now, now); await enqueueOperation(db, { userId, deviceId, entity: "debt_strategy_preferences", recordId: userId, operationType: "update", baseVersion: null, changedFields: ["strategy"], payload: { user_id: userId, strategy }, failureMessage: "Debt strategy could not be synced." }); }); }
export async function listDebtPriorities(userId: string): Promise<string[]> { const rows = await (await getDb()).getAllAsync<{ debt_account_id: string }>("SELECT debt_account_id FROM user_debt_priorities WHERE user_id=? AND deleted=0 ORDER BY priority_rank", userId); return rows.map((row) => row.debt_account_id); }
export async function setDebtPriorities(userId: string, deviceId: string, debtIds: string[]): Promise<void> { const db = await getDb(); await db.withTransactionAsync(async () => { await db.runAsync("DELETE FROM user_debt_priorities WHERE user_id=?", userId); for (const [index, id] of debtIds.entries()) { if (!(await db.getFirstAsync("SELECT id FROM debt_accounts WHERE user_id=? AND id=? AND deleted=0", userId, id))) throw new LocalDbError("VALIDATION_ERROR", "Debt priority is not accessible"); const now = new Date().toISOString(); await db.runAsync("INSERT INTO user_debt_priorities(id,user_id,debt_account_id,priority_rank,created_at,updated_at) VALUES(?,?,?,?,?,?)", randomUUID(), userId, id, index + 1, now, now); } await enqueueOperation(db, { userId, deviceId, entity: "user_debt_priorities", recordId: userId, operationType: "update", baseVersion: null, changedFields: ["priorities"], payload: { user_id: userId, priorities: debtIds }, failureMessage: "Debt priorities could not be synced." }); }); }

export async function createDebtPaymentExpense(userId: string, deviceId: string, debtAccountId: string, input: { amountMinor: number; sourceAccountId: string; paymentDate: string; subcategoryId: string; notes?: string }) {
  const debt = await getDebt(userId, debtAccountId); if (!debt) throw new LocalDbError("NOT_FOUND", "Debt not found");
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0 || input.amountMinor > debt.currentBalanceMinor) throw new LocalDbError("VALIDATION_ERROR", "Payment must be a positive amount no greater than the debt balance");
  const db = await getDb(); const paymentId = randomUUID(); const now = new Date().toISOString(); let transaction!: Awaited<ReturnType<typeof createExpenseInTransaction>>;
  await db.withTransactionAsync(async () => {
    transaction = await createExpenseInTransaction(db, userId, deviceId, { amount_centavos: input.amountMinor, source_account_id: input.sourceAccountId, subcategory_id: input.subcategoryId, transaction_date: input.paymentDate, notes: input.notes });
    await db.runAsync("DELETE FROM sync_queue WHERE operation_id = ?", transaction.operation.operation_id);
    await db.runAsync("INSERT INTO debt_payments(id,debt_account_id,user_id,transaction_id,source,payment_date,amount_centavos,principal_centavos,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", paymentId, debtAccountId, userId, transaction.transaction.id, "transaction", input.paymentDate, input.amountMinor, input.amountMinor, now, now);
    await db.runAsync("UPDATE debt_accounts SET current_balance_centavos=current_balance_centavos-?,status=CASE WHEN current_balance_centavos-?=0 THEN 'paid_off' ELSE status END,updated_at=?,version=version+1 WHERE user_id=? AND id=?", input.amountMinor, input.amountMinor, now, userId, debtAccountId);
    await enqueueOperation(db, { userId, deviceId, entity: "debt_payments", recordId: paymentId, operationType: "create", baseVersion: null, changedFields: [], payload: { id: paymentId, user_id: userId, debt_account_id: debtAccountId, transaction_id: transaction.transaction.id, linked_transaction_type: "expense", linked_source_account_id: input.sourceAccountId, linked_subcategory_id: input.subcategoryId, source: "transaction", payment_date: input.paymentDate, amount_centavos: input.amountMinor, principal_centavos: input.amountMinor, notes: input.notes ?? null }, failureMessage: "This debt payment and transaction could not be synced." });
  });
  return { transaction: transaction.transaction, paymentId };
}
