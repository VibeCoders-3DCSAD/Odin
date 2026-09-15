import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { validateContributionSchedule, type GoalContributionFrequency } from "../../features/savings-goals/contributionSchedule";

export const SAVINGS_ACCOUNT_TYPES = ["personal_savings", "high_yield_savings", "time_deposit"] as const;
export type SavingsAccountType = typeof SAVINGS_ACCOUNT_TYPES[number];
export const HYSA_INTEREST_CALCULATION_BASES = ["daily_ending_balance", "average_daily_balance", "monthly_average_balance"] as const;
export const HYSA_INTEREST_CREDIT_FREQUENCIES = ["monthly", "quarterly", "at_maturity"] as const;
export const HYSA_QUALIFICATION_PERIODS = ["monthly", "quarterly", "custom"] as const;
export type HysaInterestCalculationBasis = typeof HYSA_INTEREST_CALCULATION_BASES[number];
export type HysaInterestCreditFrequency = typeof HYSA_INTEREST_CREDIT_FREQUENCIES[number];
export type HysaQualificationPeriod = typeof HYSA_QUALIFICATION_PERIODS[number];
export type HysaBalanceTier = { minimumBalanceCentavos: number; maximumBalanceCentavos: number; interestRateBps: number };

export type SavingsAccountDetails = {
  accountId: string;
  accountType: SavingsAccountType;
  interestRateBps: number | null;
  minimumBalanceCentavos: number | null;
  baseInterestRateBps: number | null;
  effectiveInterestRateBps: number | null;
  interestConditions: string | null;
  higherRateEligible: boolean | null;
  boostedInterestRateBps: number | null;
  interestCalculationBasis: HysaInterestCalculationBasis | null;
  interestCreditFrequency: HysaInterestCreditFrequency | null;
  maximumEligibleBalanceCentavos: number | null;
  balanceTiers: HysaBalanceTier[] | null;
  requiredDepositCentavos: number | null;
  requiredDepositFrequency: HysaQualificationPeriod | null;
  requiredTransactionCount: number | null;
  requiredTransactionPeriod: HysaQualificationPeriod | null;
  directDepositThresholdCentavos: number | null;
  qualificationPeriod: HysaQualificationPeriod | null;
  promotionalInterestRateBps: number | null;
  promotionStartDate: string | null;
  promotionEndDate: string | null;
  principalCentavos: number | null;
  maturityDate: string | null;
  termMonths: number | null;
  earlyWithdrawalRule: string | null;
  plannedContributionAmountCentavos: number | null;
  contributionFrequency: GoalContributionFrequency | null;
  contributionIntervalCount: number | null;
  contributionDayOfMonth: number | null;
  contributionSecondDayOfMonth: number | null;
  contributionDayOfWeek: number | null;
  customIntervalDays: number | null;
  nextContributionDate: string | null;
  version: number;
};

export type SavingsAccountDetailsInput = Omit<SavingsAccountDetails, "accountId" | "version">;

export type ScheduledSavingsAccount = Pick<SavingsAccountDetails,
  "accountId" | "plannedContributionAmountCentavos" | "contributionFrequency" |
  "contributionIntervalCount" | "contributionDayOfMonth" |
  "contributionSecondDayOfMonth" | "contributionDayOfWeek" |
  "customIntervalDays" | "nextContributionDate"
> & { name: string };

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
  boosted_interest_rate_bps: number | null; interest_calculation_basis: HysaInterestCalculationBasis | null;
  interest_credit_frequency: HysaInterestCreditFrequency | null; maximum_eligible_balance_centavos: number | null;
  balance_tiers_json: string | null; required_deposit_centavos: number | null;
  required_deposit_frequency: HysaQualificationPeriod | null; required_transaction_count: number | null;
  required_transaction_period: HysaQualificationPeriod | null; direct_deposit_threshold_centavos: number | null;
  qualification_period: HysaQualificationPeriod | null; promotional_interest_rate_bps: number | null;
  promotion_start_date: string | null; promotion_end_date: string | null;
  principal_centavos: number | null; maturity_date: string | null; term_months: number | null;
  early_withdrawal_rule: string | null; version: number;
  planned_contribution_amount_centavos: number | null; contribution_frequency: GoalContributionFrequency | null;
  contribution_interval_count: number | null; contribution_day_of_month: number | null;
  contribution_second_day_of_month: number | null; contribution_day_of_week: number | null;
  custom_interval_days: number | null; next_contribution_date: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function getDb() { dbPromise ??= initDatabase(); return dbPromise; }
function now() { return new Date().toISOString(); }

function map(row: Row): SavingsAccountDetails {
  return {
    accountId: row.account_id, accountType: row.account_type, interestRateBps: row.interest_rate_bps,
    minimumBalanceCentavos: row.minimum_balance_centavos, baseInterestRateBps: row.base_interest_rate_bps,
    effectiveInterestRateBps: row.effective_interest_rate_bps, interestConditions: row.interest_conditions, higherRateEligible: row.higher_rate_eligible == null ? null : row.higher_rate_eligible === 1,
    boostedInterestRateBps: row.boosted_interest_rate_bps, interestCalculationBasis: row.interest_calculation_basis,
    interestCreditFrequency: row.interest_credit_frequency, maximumEligibleBalanceCentavos: row.maximum_eligible_balance_centavos,
    balanceTiers: row.balance_tiers_json ? JSON.parse(row.balance_tiers_json) as HysaBalanceTier[] : null,
    requiredDepositCentavos: row.required_deposit_centavos, requiredDepositFrequency: row.required_deposit_frequency,
    requiredTransactionCount: row.required_transaction_count, requiredTransactionPeriod: row.required_transaction_period,
    directDepositThresholdCentavos: row.direct_deposit_threshold_centavos, qualificationPeriod: row.qualification_period,
    promotionalInterestRateBps: row.promotional_interest_rate_bps, promotionStartDate: row.promotion_start_date,
    promotionEndDate: row.promotion_end_date,
    principalCentavos: row.principal_centavos, maturityDate: row.maturity_date, termMonths: row.term_months,
    earlyWithdrawalRule: row.early_withdrawal_rule, version: row.version,
    plannedContributionAmountCentavos: row.planned_contribution_amount_centavos, contributionFrequency: row.contribution_frequency,
    contributionIntervalCount: row.contribution_interval_count, contributionDayOfMonth: row.contribution_day_of_month,
    contributionSecondDayOfMonth: row.contribution_second_day_of_month, contributionDayOfWeek: row.contribution_day_of_week,
    customIntervalDays: row.custom_interval_days, nextContributionDate: row.next_contribution_date,
  };
}

function validDate(value: string | null) {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function assertNonNegative(value: number | null | undefined, field: string) {
  if (value != null && (!Number.isSafeInteger(value) || value < 0)) throw new LocalDbError("VALIDATION_ERROR", `${field} must be a non-negative whole number`);
}

export function validateSavingsAccountDetails(input: SavingsAccountDetailsInput): SavingsAccountDetailsInput {
  if (!SAVINGS_ACCOUNT_TYPES.includes(input.accountType)) throw new LocalDbError("VALIDATION_ERROR", "Savings account type is invalid");
  for (const [value, field] of [[input.interestRateBps, "interest rate"], [input.minimumBalanceCentavos, "minimum balance"], [input.baseInterestRateBps, "base interest rate"], [input.effectiveInterestRateBps, "effective interest rate"], [input.boostedInterestRateBps, "boosted interest rate"], [input.maximumEligibleBalanceCentavos, "maximum eligible balance"], [input.requiredDepositCentavos, "required deposit"], [input.directDepositThresholdCentavos, "direct deposit threshold"], [input.promotionalInterestRateBps, "promotional interest rate"]] as const) assertNonNegative(value, field);
  if (input.accountType === "personal_savings" && (input.interestRateBps === null || input.minimumBalanceCentavos === null)) throw new LocalDbError("VALIDATION_ERROR", "Personal Savings requires an interest rate and minimum balance");
  if (input.accountType === "high_yield_savings") {
    if (input.baseInterestRateBps === null || input.interestCalculationBasis === null || input.interestCreditFrequency === null) throw new LocalDbError("VALIDATION_ERROR", "HYSA requires a base interest rate, calculation basis, and credit frequency");
    if (!HYSA_INTEREST_CALCULATION_BASES.includes(input.interestCalculationBasis) || !HYSA_INTEREST_CREDIT_FREQUENCIES.includes(input.interestCreditFrequency)) throw new LocalDbError("VALIDATION_ERROR", "HYSA interest settings are invalid");
    if (input.maximumEligibleBalanceCentavos !== null && input.minimumBalanceCentavos !== null && input.maximumEligibleBalanceCentavos < input.minimumBalanceCentavos) throw new LocalDbError("VALIDATION_ERROR", "HYSA maximum eligible balance cannot be lower than the minimum balance");
    for (const value of [input.requiredDepositFrequency, input.requiredTransactionPeriod, input.qualificationPeriod]) if (value !== null && !HYSA_QUALIFICATION_PERIODS.includes(value)) throw new LocalDbError("VALIDATION_ERROR", "HYSA qualification period is invalid");
    if (input.requiredTransactionCount !== null && (!Number.isSafeInteger(input.requiredTransactionCount) || input.requiredTransactionCount <= 0)) throw new LocalDbError("VALIDATION_ERROR", "HYSA required transaction count must be a positive whole number");
    if ((input.requiredDepositCentavos !== null || input.requiredTransactionCount !== null || input.directDepositThresholdCentavos !== null) && input.qualificationPeriod === null) throw new LocalDbError("VALIDATION_ERROR", "HYSA qualification period is required when yield conditions are configured");
    if (input.promotionalInterestRateBps !== null && (!validDate(input.promotionStartDate) || !validDate(input.promotionEndDate) || input.promotionEndDate! < input.promotionStartDate!)) throw new LocalDbError("VALIDATION_ERROR", "HYSA promotional dates are invalid");
    if (input.balanceTiers) {
      for (const tier of input.balanceTiers) if (!Number.isSafeInteger(tier.minimumBalanceCentavos) || !Number.isSafeInteger(tier.maximumBalanceCentavos) || !Number.isSafeInteger(tier.interestRateBps) || tier.minimumBalanceCentavos < 0 || tier.maximumBalanceCentavos < tier.minimumBalanceCentavos || tier.interestRateBps < 0) throw new LocalDbError("VALIDATION_ERROR", "HYSA balance tiers are invalid");
      const sorted = [...input.balanceTiers].sort((a, b) => a.minimumBalanceCentavos - b.minimumBalanceCentavos);
      if (sorted.some((tier, index) => index > 0 && tier.minimumBalanceCentavos <= sorted[index - 1]!.maximumBalanceCentavos)) throw new LocalDbError("VALIDATION_ERROR", "HYSA balance tiers cannot overlap");
    }
  }
  if (input.accountType === "time_deposit") {
    if (!Number.isSafeInteger(input.principalCentavos) || (input.principalCentavos ?? 0) <= 0 || input.interestRateBps === null || !validDate(input.maturityDate) || !Number.isInteger(input.termMonths) || (input.termMonths ?? 0) <= 0 || !input.earlyWithdrawalRule?.trim()) throw new LocalDbError("VALIDATION_ERROR", "Time Deposit requires principal, interest rate, maturity date, term, and an early-withdrawal rule");
  }
  const hasContributionSchedule = [input.plannedContributionAmountCentavos, input.contributionFrequency, input.nextContributionDate].some((value) => value != null);
  if (input.accountType !== "time_deposit" && hasContributionSchedule) {
    const scheduleError = validateContributionSchedule({ plannedContributionAmountCentavos: input.plannedContributionAmountCentavos ?? -1, contributionFrequency: input.contributionFrequency, contributionIntervalCount: input.contributionIntervalCount, contributionDayOfMonth: input.contributionDayOfMonth, contributionSecondDayOfMonth: input.contributionSecondDayOfMonth, contributionDayOfWeek: input.contributionDayOfWeek, customIntervalDays: input.customIntervalDays, nextContributionDate: input.nextContributionDate });
    if (scheduleError) throw new LocalDbError("VALIDATION_ERROR", scheduleError);
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
    boosted_interest_rate_bps: input.boostedInterestRateBps, interest_calculation_basis: input.interestCalculationBasis,
    interest_credit_frequency: input.interestCreditFrequency, maximum_eligible_balance_centavos: input.maximumEligibleBalanceCentavos,
    balance_tiers: input.balanceTiers, required_deposit_centavos: input.requiredDepositCentavos,
    required_deposit_frequency: input.requiredDepositFrequency, required_transaction_count: input.requiredTransactionCount,
    required_transaction_period: input.requiredTransactionPeriod, direct_deposit_threshold_centavos: input.directDepositThresholdCentavos,
    qualification_period: input.qualificationPeriod, promotional_interest_rate_bps: input.promotionalInterestRateBps,
    promotion_start_date: input.promotionStartDate, promotion_end_date: input.promotionEndDate,
    principal_centavos: input.principalCentavos, maturity_date: input.maturityDate,
    term_months: input.termMonths, early_withdrawal_rule: input.earlyWithdrawalRule?.trim() || null,
    planned_contribution_amount_centavos: input.plannedContributionAmountCentavos, contribution_frequency: input.contributionFrequency,
    contribution_interval_count: input.contributionIntervalCount, contribution_day_of_month: input.contributionDayOfMonth,
    contribution_second_day_of_month: input.contributionSecondDayOfMonth, contribution_day_of_week: input.contributionDayOfWeek,
    custom_interval_days: input.customIntervalDays, next_contribution_date: input.nextContributionDate,
  };
}

export async function getSavingsAccountDetails(userId: string, accountId: string): Promise<SavingsAccountDetails | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>("SELECT account_id, account_type, interest_rate_bps, minimum_balance_centavos, base_interest_rate_bps, effective_interest_rate_bps, interest_conditions, higher_rate_eligible, boosted_interest_rate_bps, interest_calculation_basis, interest_credit_frequency, maximum_eligible_balance_centavos, balance_tiers_json, required_deposit_centavos, required_deposit_frequency, required_transaction_count, required_transaction_period, direct_deposit_threshold_centavos, qualification_period, promotional_interest_rate_bps, promotion_start_date, promotion_end_date, principal_centavos, maturity_date, term_months, early_withdrawal_rule, planned_contribution_amount_centavos, contribution_frequency, contribution_interval_count, contribution_day_of_month, contribution_second_day_of_month, contribution_day_of_week, custom_interval_days, next_contribution_date, version FROM savings_account_details WHERE user_id = ? AND account_id = ? AND deleted = 0", userId, accountId);
  return row ? map(row) : null;
}

export async function listScheduledSavingsAccounts(userId: string): Promise<ScheduledSavingsAccount[]> {
  const db = await getDb();
  return db.getAllAsync<ScheduledSavingsAccount>(
    `SELECT sad.account_id AS accountId, fa.name,
      sad.planned_contribution_amount_centavos AS plannedContributionAmountCentavos,
      sad.contribution_frequency AS contributionFrequency,
      sad.contribution_interval_count AS contributionIntervalCount,
      sad.contribution_day_of_month AS contributionDayOfMonth,
      sad.contribution_second_day_of_month AS contributionSecondDayOfMonth,
      sad.contribution_day_of_week AS contributionDayOfWeek,
      sad.custom_interval_days AS customIntervalDays,
      sad.next_contribution_date AS nextContributionDate
     FROM savings_account_details sad
     JOIN financial_accounts fa ON fa.id = sad.account_id AND fa.user_id = sad.user_id
     WHERE sad.user_id = ? AND sad.deleted = 0
       AND sad.account_type IN ('personal_savings', 'high_yield_savings')
       AND fa.kind = 'savings' AND fa.status = 'active' AND fa.deleted = 0
     ORDER BY fa.name COLLATE NOCASE ASC`,
    userId,
  );
}

export async function upsertSavingsAccountDetails(userId: string, deviceId: string, accountId: string, input: SavingsAccountDetailsInput): Promise<{ details: SavingsAccountDetails; operation: SyncOperation }> {
  const valid = validateSavingsAccountDetails(input); const data = payload(valid); const db = await getDb(); let result!: { details: SavingsAccountDetails; operation: SyncOperation };
  await db.withTransactionAsync(async () => {
    const account = await db.getFirstAsync<{ id: string; opened_on: string | null }>("SELECT id, opened_on FROM financial_accounts WHERE id = ? AND user_id = ? AND kind = 'savings' AND deleted = 0", accountId, userId);
    if (!account) throw new LocalDbError("NOT_FOUND", "Savings account not found");
    if (valid.accountType === "time_deposit" && account.opened_on && valid.maturityDate! <= account.opened_on) throw new LocalDbError("VALIDATION_ERROR", "Time Deposit maturity date must be after its start date");
    const current = await db.getFirstAsync<Row>("SELECT account_id, account_type, interest_rate_bps, minimum_balance_centavos, base_interest_rate_bps, effective_interest_rate_bps, interest_conditions, higher_rate_eligible, boosted_interest_rate_bps, interest_calculation_basis, interest_credit_frequency, maximum_eligible_balance_centavos, balance_tiers_json, required_deposit_centavos, required_deposit_frequency, required_transaction_count, required_transaction_period, direct_deposit_threshold_centavos, qualification_period, promotional_interest_rate_bps, promotion_start_date, promotion_end_date, principal_centavos, maturity_date, term_months, early_withdrawal_rule, planned_contribution_amount_centavos, contribution_frequency, contribution_interval_count, contribution_day_of_month, contribution_second_day_of_month, contribution_day_of_week, custom_interval_days, next_contribution_date, version FROM savings_account_details WHERE account_id = ? AND user_id = ? AND deleted = 0", accountId, userId);
    const timestamp = now();
    if (current) {
      await db.runAsync("UPDATE savings_account_details SET account_type = ?, interest_rate_bps = ?, minimum_balance_centavos = ?, base_interest_rate_bps = ?, effective_interest_rate_bps = ?, interest_conditions = ?, higher_rate_eligible = ?, boosted_interest_rate_bps = ?, interest_calculation_basis = ?, interest_credit_frequency = ?, maximum_eligible_balance_centavos = ?, balance_tiers_json = ?, required_deposit_centavos = ?, required_deposit_frequency = ?, required_transaction_count = ?, required_transaction_period = ?, direct_deposit_threshold_centavos = ?, qualification_period = ?, promotional_interest_rate_bps = ?, promotion_start_date = ?, promotion_end_date = ?, principal_centavos = ?, maturity_date = ?, term_months = ?, early_withdrawal_rule = ?, planned_contribution_amount_centavos = ?, contribution_frequency = ?, contribution_interval_count = ?, contribution_day_of_month = ?, contribution_second_day_of_month = ?, contribution_day_of_week = ?, custom_interval_days = ?, next_contribution_date = ?, version = version + 1, updated_at = ? WHERE account_id = ? AND user_id = ?", data.account_type, data.interest_rate_bps, data.minimum_balance_centavos, data.base_interest_rate_bps, data.effective_interest_rate_bps, data.interest_conditions, data.higher_rate_eligible == null ? null : data.higher_rate_eligible ? 1 : 0, data.boosted_interest_rate_bps, data.interest_calculation_basis, data.interest_credit_frequency, data.maximum_eligible_balance_centavos, data.balance_tiers ? JSON.stringify(data.balance_tiers) : null, data.required_deposit_centavos, data.required_deposit_frequency, data.required_transaction_count, data.required_transaction_period, data.direct_deposit_threshold_centavos, data.qualification_period, data.promotional_interest_rate_bps, data.promotion_start_date, data.promotion_end_date, data.principal_centavos, data.maturity_date, data.term_months, data.early_withdrawal_rule, data.planned_contribution_amount_centavos, data.contribution_frequency, data.contribution_interval_count, data.contribution_day_of_month, data.contribution_second_day_of_month, data.contribution_day_of_week, data.custom_interval_days, data.next_contribution_date, timestamp, accountId, userId);
    } else {
      await db.runAsync("INSERT INTO savings_account_details (account_id, user_id, account_type, interest_rate_bps, minimum_balance_centavos, base_interest_rate_bps, effective_interest_rate_bps, interest_conditions, higher_rate_eligible, boosted_interest_rate_bps, interest_calculation_basis, interest_credit_frequency, maximum_eligible_balance_centavos, balance_tiers_json, required_deposit_centavos, required_deposit_frequency, required_transaction_count, required_transaction_period, direct_deposit_threshold_centavos, qualification_period, promotional_interest_rate_bps, promotion_start_date, promotion_end_date, principal_centavos, maturity_date, term_months, early_withdrawal_rule, planned_contribution_amount_centavos, contribution_frequency, contribution_interval_count, contribution_day_of_month, contribution_second_day_of_month, contribution_day_of_week, custom_interval_days, next_contribution_date, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)", accountId, userId, data.account_type, data.interest_rate_bps, data.minimum_balance_centavos, data.base_interest_rate_bps, data.effective_interest_rate_bps, data.interest_conditions, data.higher_rate_eligible == null ? null : data.higher_rate_eligible ? 1 : 0, data.boosted_interest_rate_bps, data.interest_calculation_basis, data.interest_credit_frequency, data.maximum_eligible_balance_centavos, data.balance_tiers ? JSON.stringify(data.balance_tiers) : null, data.required_deposit_centavos, data.required_deposit_frequency, data.required_transaction_count, data.required_transaction_period, data.direct_deposit_threshold_centavos, data.qualification_period, data.promotional_interest_rate_bps, data.promotion_start_date, data.promotion_end_date, data.principal_centavos, data.maturity_date, data.term_months, data.early_withdrawal_rule, data.planned_contribution_amount_centavos, data.contribution_frequency, data.contribution_interval_count, data.contribution_day_of_month, data.contribution_second_day_of_month, data.contribution_day_of_week, data.custom_interval_days, data.next_contribution_date, timestamp, timestamp);
    }
    const operation = await enqueueOperation(db, { userId, deviceId, entity: "savings_account_details", recordId: accountId, operationType: current ? "update" : "create", baseVersion: current?.version ?? null, changedFields: Object.keys(data), payload: data, failureMessage: "This savings-account information could not be synchronized." });
    result = { details: (await getSavingsAccountDetails(userId, accountId))!, operation };
  });
  return result;
}
