import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";

export const SAVINGS_ACCOUNT_TYPES = ["personal_savings", "high_yield_savings", "time_deposit"] as const;
export type SavingsAccountType = typeof SAVINGS_ACCOUNT_TYPES[number];

export type SavingsAccountDetails = {
  accountId: string;
  accountType: SavingsAccountType;
  interestRateBps: number | null;
  minimumBalanceCentavos: number | null;
  baseInterestRateBps: number | null;
  effectiveInterestRateBps: number | null;
  interestConditions: string | null;
  higherRateEligible: boolean | null;
  principalCentavos: number | null;
  maturityDate: string | null;
  termMonths: number | null;
  earlyWithdrawalRule: string | null;
  version: number;
};

export type SavingsAccountDetailsInput = Omit<SavingsAccountDetails, "accountId" | "version">;

export function getApplicableSavingsInterestRateBps(details: Pick<SavingsAccountDetails, "accountType" | "interestRateBps" | "baseInterestRateBps" | "effectiveInterestRateBps" | "higherRateEligible">): number | null {
  if (details.accountType === "high_yield_savings") {
    return details.higherRateEligible ? details.effectiveInterestRateBps : details.baseInterestRateBps;
  }
  return details.interestRateBps;
}

type Row = {
  account_id: string; account_type: SavingsAccountType; interest_rate_bps: number | null;
  minimum_balance_centavos: number | null; base_interest_rate_bps: number | null;
  effective_interest_rate_bps: number | null; interest_conditions: string | null;
  higher_rate_eligible: number | null;
  principal_centavos: number | null; maturity_date: string | null; term_months: number | null;
  early_withdrawal_rule: string | null; version: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function getDb() { dbPromise ??= initDatabase(); return dbPromise; }
function now() { return new Date().toISOString(); }

function map(row: Row): SavingsAccountDetails {
  return {
    accountId: row.account_id, accountType: row.account_type, interestRateBps: row.interest_rate_bps,
    minimumBalanceCentavos: row.minimum_balance_centavos, baseInterestRateBps: row.base_interest_rate_bps,
    effectiveInterestRateBps: row.effective_interest_rate_bps, interestConditions: row.interest_conditions, higherRateEligible: row.higher_rate_eligible == null ? null : row.higher_rate_eligible === 1,
    principalCentavos: row.principal_centavos, maturityDate: row.maturity_date, termMonths: row.term_months,
    earlyWithdrawalRule: row.early_withdrawal_rule, version: row.version,
  };
}

function validDate(value: string | null) {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function assertNonNegative(value: number | null, field: string) {
  if (value !== null && (!Number.isSafeInteger(value) || value < 0)) throw new LocalDbError("VALIDATION_ERROR", `${field} must be a non-negative whole number`);
}

export function validateSavingsAccountDetails(input: SavingsAccountDetailsInput): SavingsAccountDetailsInput {
  if (!SAVINGS_ACCOUNT_TYPES.includes(input.accountType)) throw new LocalDbError("VALIDATION_ERROR", "Savings account type is invalid");
  for (const [value, field] of [[input.interestRateBps, "interest rate"], [input.minimumBalanceCentavos, "minimum balance"], [input.baseInterestRateBps, "base interest rate"], [input.effectiveInterestRateBps, "effective interest rate"]] as const) assertNonNegative(value, field);
  if (input.accountType === "personal_savings" && (input.interestRateBps === null || input.minimumBalanceCentavos === null)) throw new LocalDbError("VALIDATION_ERROR", "Personal Savings requires an interest rate and minimum balance");
  if (input.accountType === "high_yield_savings" && (input.baseInterestRateBps === null || input.effectiveInterestRateBps === null || !input.interestConditions?.trim() || typeof input.higherRateEligible !== "boolean")) throw new LocalDbError("VALIDATION_ERROR", "HYSA requires base and effective interest rates, requirements, and an eligibility choice");
  if (input.accountType === "high_yield_savings" && input.effectiveInterestRateBps! < input.baseInterestRateBps!) throw new LocalDbError("VALIDATION_ERROR", "HYSA effective interest rate cannot be lower than the base rate");
  if (input.accountType === "time_deposit") {
    if (!Number.isSafeInteger(input.principalCentavos) || (input.principalCentavos ?? 0) <= 0 || input.interestRateBps === null || !validDate(input.maturityDate) || !Number.isInteger(input.termMonths) || (input.termMonths ?? 0) <= 0 || !input.earlyWithdrawalRule?.trim()) throw new LocalDbError("VALIDATION_ERROR", "Time Deposit requires principal, interest rate, maturity date, term, and an early-withdrawal rule");
  }
  if (input.interestConditions != null && input.interestConditions.length > 1_000) throw new LocalDbError("VALIDATION_ERROR", "Interest conditions must be 1000 characters or fewer");
  if (input.earlyWithdrawalRule != null && input.earlyWithdrawalRule.length > 1_000) throw new LocalDbError("VALIDATION_ERROR", "Early-withdrawal rule must be 1000 characters or fewer");
  return input;
}

function payload(input: SavingsAccountDetailsInput) {
  return {
    account_type: input.accountType, interest_rate_bps: input.interestRateBps,
    minimum_balance_centavos: input.minimumBalanceCentavos, base_interest_rate_bps: input.baseInterestRateBps,
    effective_interest_rate_bps: input.effectiveInterestRateBps, interest_conditions: input.interestConditions?.trim() || null, higher_rate_eligible: input.higherRateEligible,
    principal_centavos: input.principalCentavos, maturity_date: input.maturityDate,
    term_months: input.termMonths, early_withdrawal_rule: input.earlyWithdrawalRule?.trim() || null,
  };
}

export async function getSavingsAccountDetails(userId: string, accountId: string): Promise<SavingsAccountDetails | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>("SELECT account_id, account_type, interest_rate_bps, minimum_balance_centavos, base_interest_rate_bps, effective_interest_rate_bps, interest_conditions, higher_rate_eligible, principal_centavos, maturity_date, term_months, early_withdrawal_rule, version FROM savings_account_details WHERE user_id = ? AND account_id = ? AND deleted = 0", userId, accountId);
  return row ? map(row) : null;
}

export async function upsertSavingsAccountDetails(userId: string, deviceId: string, accountId: string, input: SavingsAccountDetailsInput): Promise<{ details: SavingsAccountDetails; operation: SyncOperation }> {
  const valid = validateSavingsAccountDetails(input); const data = payload(valid); const db = await getDb(); let result!: { details: SavingsAccountDetails; operation: SyncOperation };
  await db.withTransactionAsync(async () => {
    const account = await db.getFirstAsync<{ id: string; opened_on: string | null }>("SELECT id, opened_on FROM financial_accounts WHERE id = ? AND user_id = ? AND kind = 'savings' AND deleted = 0", accountId, userId);
    if (!account) throw new LocalDbError("NOT_FOUND", "Savings account not found");
    if (valid.accountType === "time_deposit" && account.opened_on && valid.maturityDate! <= account.opened_on) throw new LocalDbError("VALIDATION_ERROR", "Time Deposit maturity date must be after its start date");
    const current = await db.getFirstAsync<Row>("SELECT account_id, account_type, interest_rate_bps, minimum_balance_centavos, base_interest_rate_bps, effective_interest_rate_bps, interest_conditions, higher_rate_eligible, principal_centavos, maturity_date, term_months, early_withdrawal_rule, version FROM savings_account_details WHERE account_id = ? AND user_id = ? AND deleted = 0", accountId, userId);
    const timestamp = now();
    if (current) {
      await db.runAsync("UPDATE savings_account_details SET account_type = ?, interest_rate_bps = ?, minimum_balance_centavos = ?, base_interest_rate_bps = ?, effective_interest_rate_bps = ?, interest_conditions = ?, higher_rate_eligible = ?, principal_centavos = ?, maturity_date = ?, term_months = ?, early_withdrawal_rule = ?, version = version + 1, updated_at = ? WHERE account_id = ? AND user_id = ?", data.account_type, data.interest_rate_bps, data.minimum_balance_centavos, data.base_interest_rate_bps, data.effective_interest_rate_bps, data.interest_conditions, data.higher_rate_eligible == null ? null : data.higher_rate_eligible ? 1 : 0, data.principal_centavos, data.maturity_date, data.term_months, data.early_withdrawal_rule, timestamp, accountId, userId);
    } else {
      await db.runAsync("INSERT INTO savings_account_details (account_id, user_id, account_type, interest_rate_bps, minimum_balance_centavos, base_interest_rate_bps, effective_interest_rate_bps, interest_conditions, higher_rate_eligible, principal_centavos, maturity_date, term_months, early_withdrawal_rule, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)", accountId, userId, data.account_type, data.interest_rate_bps, data.minimum_balance_centavos, data.base_interest_rate_bps, data.effective_interest_rate_bps, data.interest_conditions, data.higher_rate_eligible == null ? null : data.higher_rate_eligible ? 1 : 0, data.principal_centavos, data.maturity_date, data.term_months, data.early_withdrawal_rule, timestamp, timestamp);
    }
    const operation = await enqueueOperation(db, { userId, deviceId, entity: "savings_account_details", recordId: accountId, operationType: current ? "update" : "create", baseVersion: current?.version ?? null, changedFields: Object.keys(data), payload: data, failureMessage: "This savings-account information could not be synchronized." });
    result = { details: (await getSavingsAccountDetails(userId, accountId))!, operation };
  });
  return result;
}
