import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";
import { randomUUID } from "../uuid";
import { createExpenseInTransaction } from "./ledger";
import {
  creditBalance,
  type Cycle,
  routePostingDate,
  type Statement,
  statementPaymentStatus,
  installmentAmortization,
  nextCycleAfter,
  validateStatementStrategy,
} from "../../features/debt-manager/creditCardLogic";

export type CreditCard = {
  accountId: string;
  issuer: string | null;
  creditLimitMinor: number;
  availableCreditMinor: number | null;
  defaultCutoffDate: string;
  defaultStatementDate: string;
  notes: string | null;
};
export type CardInput =
  & Omit<CreditCard, "availableCreditMinor" | "issuer" | "notes">
  & {
    issuer?: string | null;
    availableCreditMinor?: number | null;
    notes?: string | null;
  };
type Db = SQLite.SQLiteDatabase;
type InstallmentInput = {
  accountId: string;
  description: string;
  originalPrincipalMinor: number;
  remainingPrincipalMinor: number;
  termMonths: number;
  remainingMonths: number;
  monthlyAmortizationMinor: number;
  interestRateBps?: number;
  interestType: "zero_interest" | "interest_bearing";
  settlementStatus?: "active" | "settlement_requested" | "completed";
  transactionId?: string;
};
type PaymentInput = {
  cycleId: string;
  statementId: string | null;
  amountMinor: number;
  paymentDate: string;
  sourceAccountId: string | null;
  subcategoryId: string | null;
  notes?: string;
  clientMutationId?: string;
};

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftMonth(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}
export type CreditCardCycle = Cycle & {
  statementId: string | null;
  statementBalanceMinor: number | null;
  minimumDueMinor: number | null;
  financeChargeMinor: number | null;
  dueDate: string | null;
  paidMinor: number;
  paymentStatus: "unpaid" | "fully_paid" | "minimum_satisfied" | "partially_paid" | "overpaid" | null;
  creditBalanceMinor: number;
  strategy: "pay_full" | "pay_minimum" | "custom" | null;
  customAmountMinor: number | null;
  estimatedStatementBalanceMinor: number;
  statementExpected: boolean;
};
export type CreditCardInstallment = {
  id: string;
  accountId: string;
  transactionId: string | null;
  description: string;
  originalPrincipalMinor: number;
  remainingPrincipalMinor: number;
  termMonths: number;
  remainingMonths: number;
  monthlyAmortizationMinor: number;
  interestRateBps: number;
  interestType: "zero_interest" | "interest_bearing";
  settlementStatus: "active" | "settlement_requested" | "completed";
};
export type CreditCardPayment = {
  id: string;
  cycleId: string;
  statementId: string | null;
  transactionId: string | null;
  amountMinor: number;
  paymentDate: string;
  issuerRecognized: boolean;
};
export type CreditCardSettlement = {
  id: string;
  installmentId: string;
  settlementDate: string;
  settlementAmountMinor: number;
  status: "requested" | "recognized";
};

let dbPromise: Promise<Db> | null = null;
const getDb = () => (dbPromise ??= initDatabase());
const date = (value: string, field: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!parsed || parsed.getUTCFullYear() !== Number(match![1]) || parsed.getUTCMonth() !== Number(match![2]) - 1 || parsed.getUTCDate() !== Number(match![3])) {
    throw new LocalDbError(
      "VALIDATION_ERROR",
      `${field} must be a valid YYYY-MM-DD date`,
    );
  }
};
const money = (value: number, field: string, positive = false) => {
  if (!Number.isInteger(value) || value < (positive ? 1 : 0)) {
    throw new LocalDbError(
      "VALIDATION_ERROR",
      `${field} must be a ${positive ? "positive" : "non-negative"} integer`,
    );
  }
};
const operation = (
  db: Db,
  userId: string,
  deviceId: string,
  entity: Extract<SyncOperation["entity"], `credit_card_${string}`>,
  id: string,
  payload: Record<string, unknown>,
  changedFields: string[] = [],
  operationType: SyncOperation["operation_type"] = "create",
  baseVersion: number | null = null,
) =>
  enqueueOperation(db, {
    userId,
    deviceId,
    entity,
    recordId: id,
    operationType,
    baseVersion,
    changedFields,
    payload: { id, user_id: userId, ...payload },
    failureMessage: "This credit-card change could not be synced.",
  });

function validateCard(input: CardInput) {
  money(input.creditLimitMinor, "creditLimitMinor", true);
  if (input.availableCreditMinor != null) {
    money(input.availableCreditMinor, "availableCreditMinor");
    if (input.availableCreditMinor > input.creditLimitMinor) {
      throw new LocalDbError(
        "VALIDATION_ERROR",
        "availableCreditMinor cannot exceed creditLimitMinor",
      );
    }
  }
  date(input.defaultCutoffDate, "defaultCutoffDate");
  date(input.defaultStatementDate, "defaultStatementDate");
}
async function owned(
  db: Db,
  table: string,
  id: string,
  userId: string,
  message: string,
  key = "id",
) {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT ${key} AS value FROM ${table} WHERE ${key}=? AND user_id=? AND deleted=0`,
    id,
    userId,
  );
  if (!row) throw new LocalDbError("NOT_FOUND", message);
  return row;
}

export async function listCreditCards(userId: string): Promise<CreditCard[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CreditCard>(
    "SELECT account_id AS accountId,issuer,credit_limit_centavos AS creditLimitMinor,available_credit_centavos AS availableCreditMinor,default_cutoff_date AS defaultCutoffDate,default_statement_date AS defaultStatementDate,notes FROM credit_card_details WHERE user_id=? AND deleted=0 ORDER BY issuer,account_id",
    userId,
  );
  return rows;
}
export async function getCreditCard(
  userId: string,
  accountId: string,
): Promise<CreditCard | null> {
  const db = await getDb();
  return db.getFirstAsync<CreditCard>(
    "SELECT account_id AS accountId,issuer,credit_limit_centavos AS creditLimitMinor,available_credit_centavos AS availableCreditMinor,default_cutoff_date AS defaultCutoffDate,default_statement_date AS defaultStatementDate,notes FROM credit_card_details WHERE account_id=? AND user_id=? AND deleted=0",
    accountId,
    userId,
  );
}

export async function saveCreditCard(
  userId: string,
  deviceId: string,
  input: CardInput,
): Promise<SyncOperation> {
  validateCard(input);
  const db = await getDb();
  const now = new Date().toISOString();
  let result!: SyncOperation;
  await db.withTransactionAsync(async () => {
    await owned(
      db,
      "financial_accounts",
      input.accountId,
      userId,
      "Credit-card account not found",
    );
    const account = await db.getFirstAsync<{ kind: string }>("SELECT kind FROM financial_accounts WHERE id=? AND user_id=? AND status='active' AND deleted=0", input.accountId, userId);
    if (account?.kind !== "credit_card") throw new LocalDbError("VALIDATION_ERROR", "Card details require an owned credit-card account");
    const current = await db.getFirstAsync<{ version: number }>(
      "SELECT version FROM credit_card_details WHERE account_id=? AND user_id=? AND deleted=0",
      input.accountId,
      userId,
    );
    await db.runAsync(
      "INSERT INTO credit_card_details(account_id,user_id,issuer,credit_limit_centavos,available_credit_centavos,default_cutoff_date,default_statement_date,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET issuer=excluded.issuer,credit_limit_centavos=excluded.credit_limit_centavos,available_credit_centavos=excluded.available_credit_centavos,default_cutoff_date=excluded.default_cutoff_date,default_statement_date=excluded.default_statement_date,notes=excluded.notes,deleted=0,version=credit_card_details.version+1,updated_at=excluded.updated_at",
      input.accountId,
      userId,
      input.issuer ?? null,
      input.creditLimitMinor,
      input.availableCreditMinor ?? null,
      input.defaultCutoffDate,
      input.defaultStatementDate,
      input.notes ?? null,
      now,
      now,
    );
    result = await operation(
      db,
      userId,
      deviceId,
      "credit_card_details",
      input.accountId,
      {
        account_id: input.accountId,
        issuer: input.issuer ?? null,
        credit_limit_centavos: input.creditLimitMinor,
        available_credit_centavos: input.availableCreditMinor ?? null,
        default_cutoff_date: input.defaultCutoffDate,
        default_statement_date: input.defaultStatementDate,
        notes: input.notes ?? null,
      },
      [
        "issuer",
        "credit_limit_centavos",
        "available_credit_centavos",
        "default_cutoff_date",
        "default_statement_date",
        "notes",
      ],
      current ? "update" : "create",
      current?.version ?? null,
    );
  });
  return result;
}
export const updateCreditCard = saveCreditCard;
export async function deleteCreditCard(
  userId: string,
  deviceId: string,
  accountId: string,
): Promise<SyncOperation> {
  const db = await getDb();
  const current = await db.getFirstAsync<{ version: number }>(
    "SELECT version FROM credit_card_details WHERE account_id=? AND user_id=? AND deleted=0",
    accountId,
    userId,
  );
  if (!current) {
    throw new LocalDbError("NOT_FOUND", "Credit-card details not found");
  }
  await db.runAsync(
    "UPDATE credit_card_details SET deleted=1,version=version+1,updated_at=? WHERE account_id=? AND user_id=?",
    new Date().toISOString(),
    accountId,
    userId,
  );
  return operation(
    db,
    userId,
    deviceId,
    "credit_card_details",
    accountId,
    { account_id: accountId },
    [],
    "delete",
    current.version,
  );
}

export async function createCreditCardCycle(
  userId: string,
  deviceId: string,
  input: {
    accountId: string;
    cycleStartDate: string;
    cutoffDate: string;
    statementDate: string;
  },
) {
  date(input.cycleStartDate, "cycleStartDate");
  date(input.cutoffDate, "cutoffDate");
  date(input.statementDate, "statementDate");
  if (
    input.cycleStartDate > input.cutoffDate ||
    input.cutoffDate > input.statementDate
  ) throw new LocalDbError("VALIDATION_ERROR", "cycle dates must be ordered");
  const db = await getDb();
  await owned(
    db,
    "credit_card_details",
    input.accountId,
    userId,
    "Credit-card details not found",
    "account_id",
  );
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO credit_card_cycles(id,user_id,account_id,cycle_start_date,cutoff_date,statement_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
    id,
    userId,
    input.accountId,
    input.cycleStartDate,
    input.cutoffDate,
    input.statementDate,
    now,
    now,
  );
  return {
    id,
    operation: await operation(db, userId, deviceId, "credit_card_cycles", id, {
      account_id: input.accountId,
      cycle_start_date: input.cycleStartDate,
      cutoff_date: input.cutoffDate,
      statement_date: input.statementDate,
    }),
  };
}

export async function createCreditCardInstallment(
  userId: string,
  deviceId: string,
  input: InstallmentInput,
) {
  money(input.originalPrincipalMinor, "originalPrincipalMinor", true);
  money(input.remainingPrincipalMinor, "remainingPrincipalMinor");
  money(input.termMonths, "termMonths", true);
  money(input.remainingMonths, "remainingMonths");
  money(input.monthlyAmortizationMinor, "monthlyAmortizationMinor", true);
  if (input.interestType === "zero_interest" && input.interestRateBps && input.interestRateBps !== 0) {
    throw new LocalDbError("VALIDATION_ERROR", "Zero-interest installments cannot have an interest rate");
  }
  const expectedAmortization = installmentAmortization(input.originalPrincipalMinor, input.termMonths, input.interestType, input.interestRateBps ?? 0);
  if (input.monthlyAmortizationMinor !== expectedAmortization) {
    throw new LocalDbError("VALIDATION_ERROR", "monthlyAmortizationMinor does not match the principal, term, interest type, and rate");
  }
  if (
    input.remainingPrincipalMinor > input.originalPrincipalMinor ||
    input.remainingMonths > input.termMonths
  ) {
    throw new LocalDbError(
      "VALIDATION_ERROR",
      "remaining installment values cannot exceed original values",
    );
  }
  const db = await getDb();
  await owned(
    db,
    "credit_card_details",
    input.accountId,
    userId,
    "Credit-card details not found",
    "account_id",
  );
  if (input.transactionId) {
    const tx = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM transactions WHERE id=? AND user_id=? AND source_account_id=? AND deleted=0",
      input.transactionId,
      userId,
      input.accountId,
    );
    if (!tx) {
      throw new LocalDbError(
        "NOT_FOUND",
        "Installment transaction not found for this card",
      );
    }
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO credit_card_installments(id,user_id,account_id,transaction_id,description,original_principal_centavos,remaining_principal_centavos,term_months,remaining_months,monthly_amortization_centavos,interest_rate_bps,interest_type,settlement_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    id,
    userId,
    input.accountId,
    input.transactionId ?? null,
    input.description.trim(),
    input.originalPrincipalMinor,
    input.remainingPrincipalMinor,
    input.termMonths,
    input.remainingMonths,
    input.monthlyAmortizationMinor,
    input.interestRateBps ?? 0,
    input.interestType,
    input.settlementStatus ?? "active",
    now,
    now,
  );
  return {
    id,
    operation: await operation(
      db,
      userId,
      deviceId,
      "credit_card_installments",
      id,
      {
        account_id: input.accountId,
        transaction_id: input.transactionId ?? null,
        description: input.description.trim(),
        original_principal_centavos: input.originalPrincipalMinor,
        remaining_principal_centavos: input.remainingPrincipalMinor,
        term_months: input.termMonths,
        remaining_months: input.remainingMonths,
        monthly_amortization_centavos: input.monthlyAmortizationMinor,
        interest_rate_bps: input.interestRateBps ?? 0,
        interest_type: input.interestType,
        settlement_status: input.settlementStatus ?? "active",
      },
    ),
  };
}

export async function recordCreditCardPurchase(
  userId: string,
  deviceId: string,
  input: {
    accountId: string;
    cycleId?: string;
    amountMinor: number;
    transactionDate: string;
    postingDate?: string;
    subcategoryId: string;
    merchant?: string;
    purchaseType: "regular" | "installment";
    installment?: InstallmentInput;
    clientMutationId?: string;
  },
) {
  money(input.amountMinor, "amountMinor", true);
  date(input.transactionDate, "transactionDate");
  if (input.postingDate) date(input.postingDate, "postingDate");
  if (input.purchaseType === "installment" && !input.installment) {
    throw new LocalDbError(
      "VALIDATION_ERROR",
      "Installment details are required",
    );
  }
  const db = await getDb();
  let result!: {
    transactionId: string;
    cycleId: string;
    operation: SyncOperation;
  };
  await db.withTransactionAsync(async () => {
    if (input.clientMutationId) {
      const existing = await db.getFirstAsync<{ transactionId: string; cycleId: string }>("SELECT transaction_id AS transactionId,cycle_id AS cycleId FROM credit_card_transactions WHERE user_id=? AND client_mutation_id=? AND deleted=0", userId, input.clientMutationId);
      if (existing) { result = { ...existing, operation: {} as SyncOperation }; return; }
    }
    const card = await db.getFirstAsync<
      { available: number | null; credit_limit: number; default_cutoff_date: string; default_statement_date: string }
    >(
      "SELECT available_credit_centavos AS available,credit_limit_centavos AS credit_limit,default_cutoff_date,default_statement_date FROM credit_card_details WHERE account_id=? AND user_id=? AND deleted=0",
      input.accountId,
      userId,
    );
    if (!card) {
      throw new LocalDbError("NOT_FOUND", "Credit-card details not found");
    }
    if ((card.available ?? card.credit_limit) < input.amountMinor) {
      throw new LocalDbError(
        "VALIDATION_ERROR",
        "Purchase exceeds available credit",
      );
    }
    const rows = await db.getAllAsync<Cycle>(
      input.cycleId
        ? "SELECT id,cycle_start_date AS cycleStartDate,cutoff_date AS cutoffDate,statement_date AS statementDate FROM credit_card_cycles WHERE id=? AND account_id=? AND user_id=? AND deleted=0"
        : "SELECT id,cycle_start_date AS cycleStartDate,cutoff_date AS cutoffDate,statement_date AS statementDate FROM credit_card_cycles WHERE account_id=? AND user_id=? AND deleted=0",
      ...(input.cycleId
        ? [input.cycleId, input.accountId, userId]
        : [input.accountId, userId]),
    );
     const effectiveDate = input.postingDate ?? input.transactionDate;
     let cycle = input.cycleId
       ? rows[0]
       : [...rows].sort((a, b) => a.cutoffDate.localeCompare(b.cutoffDate)).find((item) => effectiveDate >= item.cycleStartDate && effectiveDate <= item.cutoffDate);
      if (!cycle && !input.cycleId) {
        const effectiveDate = input.postingDate ?? input.transactionDate;
        let cutoffDate = rows.length
          ? nextCycleAfter([...rows].sort((a, b) => b.cutoffDate.localeCompare(a.cutoffDate))[0]!).cutoffDate
          : card.default_cutoff_date;
        while (effectiveDate > cutoffDate) cutoffDate = shiftMonth(cutoffDate);
        while (effectiveDate < shiftDate(cutoffDate, -29)) {
          const previous = new Date(`${cutoffDate}T00:00:00Z`);
          previous.setUTCMonth(previous.getUTCMonth() - 1);
          cutoffDate = previous.toISOString().slice(0, 10);
        }
        let statementDate = card.default_statement_date;
        while (statementDate <= cutoffDate) statementDate = shiftMonth(statementDate);
        const next = {
          id: "",
          cycleStartDate: shiftDate(cutoffDate, -29),
          cutoffDate,
          statementDate,
        };
        const id = randomUUID(); const now = new Date().toISOString();
       await db.runAsync("INSERT INTO credit_card_cycles(id,user_id,account_id,cycle_start_date,cutoff_date,statement_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", id, userId, input.accountId, next.cycleStartDate, next.cutoffDate, next.statementDate, now, now);
       await operation(db, userId, deviceId, "credit_card_cycles", id, { account_id: input.accountId, cycle_start_date: next.cycleStartDate, cutoff_date: next.cutoffDate, statement_date: next.statementDate });
       cycle = { ...next, id };
     }
    if (!cycle) throw new LocalDbError("NOT_FOUND", "Billing cycle not found");
    const tx = await createExpenseInTransaction(db, userId, deviceId, {
      // The purchase reserves the full issuer charge, but the cycle records only this month's amortization.
       amount_centavos: input.amountMinor,
      source_account_id: input.accountId,
      subcategory_id: input.subcategoryId,
      transaction_date: input.transactionDate,
      credit_card_posting_date: input.postingDate,
      merchant_name: input.merchant,
      client_mutation_id: input.clientMutationId,
    });
    let installmentId: string | null = null;
    if (input.purchaseType === "installment") {
      installmentId = (await createCreditCardInstallment(userId, deviceId, {
        ...input.installment!,
        accountId: input.accountId,
        transactionId: tx.transaction.id,
      })).id;
    }
    const now = new Date().toISOString();
    await db.runAsync(
      "INSERT INTO credit_card_transactions(transaction_id,user_id,account_id,cycle_id,purchase_type,installment_id,client_mutation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
      tx.transaction.id,
      userId,
      input.accountId,
      cycle.id,
      input.purchaseType,
      installmentId,
      input.clientMutationId ?? null,
      now,
      now,
    );
    const ccOp = await operation(
      db,
      userId,
      deviceId,
      "credit_card_transactions",
      tx.transaction.id,
      {
        transaction_id: tx.transaction.id,
        account_id: input.accountId,
        cycle_id: cycle.id,
        purchase_type: input.purchaseType,
        installment_id: installmentId,
        client_mutation_id: input.clientMutationId ?? null,
      },
    );
    if (
      (await db.runAsync(
        "UPDATE credit_card_details SET available_credit_centavos=COALESCE(available_credit_centavos,credit_limit_centavos)-?,version=version+1,updated_at=? WHERE account_id=? AND user_id=? AND deleted=0 AND COALESCE(available_credit_centavos,credit_limit_centavos)>=?",
        input.amountMinor,
        now,
        input.accountId,
        userId,
        input.amountMinor,
      )).changes !== 1
    ) {
      throw new LocalDbError(
        "VALIDATION_ERROR",
        "Purchase exceeds available credit",
      );
    }
    result = {
      transactionId: tx.transaction.id,
      cycleId: cycle.id,
      operation: ccOp,
    };
  });
  return result;
}

export async function recordCreditCardStatement(
  userId: string,
  deviceId: string,
  input: {
    cycleId: string;
    statementBalanceMinor: number;
    minimumDueMinor: number;
    financeChargeMinor?: number;
    dueDate: string;
  },
) {
  money(input.statementBalanceMinor, "statementBalanceMinor");
  money(input.minimumDueMinor, "minimumDueMinor");
  if (input.minimumDueMinor > input.statementBalanceMinor) {
    throw new LocalDbError(
      "VALIDATION_ERROR",
      "minimumDueMinor cannot exceed statementBalanceMinor",
    );
  }
  date(input.dueDate, "dueDate");
  const db = await getDb();
  await owned(
    db,
    "credit_card_cycles",
    input.cycleId,
    userId,
    "Billing cycle not found",
  );
  const existing = await db.getFirstAsync<{ id: string; version: number }>(
    "SELECT id,version FROM credit_card_statements WHERE cycle_id=? AND user_id=? AND deleted=0",
    input.cycleId,
    userId,
  );
  const id = existing?.id ?? randomUUID();
  const now = new Date().toISOString();
  if (existing) await db.runAsync(
    "UPDATE credit_card_statements SET statement_balance_centavos=?,minimum_due_centavos=?,finance_charge_centavos=?,due_date=?,authoritative=1,version=version+1,updated_at=? WHERE id=? AND user_id=?",
    input.statementBalanceMinor, input.minimumDueMinor, input.financeChargeMinor ?? 0, input.dueDate, now, id, userId,
  );
  else await db.runAsync(
    "INSERT INTO credit_card_statements(id,user_id,cycle_id,statement_balance_centavos,minimum_due_centavos,finance_charge_centavos,due_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
    id, userId, input.cycleId, input.statementBalanceMinor, input.minimumDueMinor, input.financeChargeMinor ?? 0, input.dueDate, now, now,
  );
  return {
    id,
    operation: await operation(
      db,
      userId,
      deviceId,
      "credit_card_statements",
      id,
      {
        cycle_id: input.cycleId,
        statement_balance_centavos: input.statementBalanceMinor,
        minimum_due_centavos: input.minimumDueMinor,
        finance_charge_centavos: input.financeChargeMinor ?? 0,
        due_date: input.dueDate,
        authoritative: true,
      }, ["statement_balance_centavos", "minimum_due_centavos", "finance_charge_centavos", "due_date", "authoritative"], existing ? "update" : "create", existing?.version ?? null,
    ),
  };
}

export async function listCreditCardCycles(userId: string, accountId: string): Promise<CreditCardCycle[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CreditCardCycle & { authoritative: number }>(
    `SELECT c.id,c.cycle_start_date AS cycleStartDate,c.cutoff_date AS cutoffDate,c.statement_date AS statementDate,
      s.id AS statementId,s.statement_balance_centavos AS statementBalanceMinor,s.minimum_due_centavos AS minimumDueMinor,
      s.finance_charge_centavos AS financeChargeMinor,s.due_date AS dueDate,s.authoritative,
       COALESCE((SELECT SUM(p.amount_centavos) FROM credit_card_payments p WHERE p.cycle_id=c.id AND p.user_id=c.user_id AND p.deleted=0),0) AS paidMinor,
       COALESCE((SELECT SUM(a.amount_centavos) FROM credit_card_credit_applications a JOIN credit_card_payments p ON p.id=a.payment_id WHERE p.cycle_id=c.id AND a.user_id=c.user_id AND a.deleted=0),0) AS appliedMinor,
      st.strategy,st.custom_amount_centavos AS customAmountMinor,
      COALESCE((SELECT SUM(CASE WHEN ct.purchase_type='installment' THEN i.monthly_amortization_centavos ELSE t.amount_centavos END)
        FROM credit_card_transactions ct
        JOIN transactions t ON t.id=ct.transaction_id AND t.user_id=ct.user_id AND t.deleted=0
        LEFT JOIN credit_card_installments i ON i.id=ct.installment_id AND i.user_id=ct.user_id AND i.deleted=0
        WHERE ct.cycle_id=c.id AND ct.user_id=c.user_id AND ct.deleted=0),0) AS estimatedStatementBalanceMinor
      FROM credit_card_cycles c LEFT JOIN credit_card_statements s ON s.cycle_id=c.id AND s.user_id=c.user_id AND s.deleted=0
      LEFT JOIN credit_card_statement_strategies st ON st.statement_id=s.id AND st.user_id=c.user_id AND st.deleted=0
      WHERE c.account_id=? AND c.user_id=? AND c.deleted=0 ORDER BY c.cutoff_date DESC`,
    accountId,
    userId,
  );
  return rows.map((row) => ({
    ...row,
    statementId: row.statementId ?? null,
    statementBalanceMinor: row.statementBalanceMinor ?? null,
    minimumDueMinor: row.minimumDueMinor ?? null,
    financeChargeMinor: row.financeChargeMinor ?? null,
    dueDate: row.dueDate ?? null,
    paymentStatus: row.statementBalanceMinor == null || row.minimumDueMinor == null
      ? null
      : statementPaymentStatus({ statementBalanceMinor: row.statementBalanceMinor, minimumDueMinor: row.minimumDueMinor, authoritative: Boolean(row.authoritative) }, row.paidMinor),
     creditBalanceMinor: row.statementBalanceMinor == null ? 0 : Math.max(0, row.paidMinor - row.statementBalanceMinor - ((row as CreditCardCycle & { appliedMinor?: number }).appliedMinor ?? 0)),
     strategy: row.strategy ?? null,
     customAmountMinor: (row as CreditCardCycle & { customAmountMinor?: number | null }).customAmountMinor ?? null,
     estimatedStatementBalanceMinor: (row as CreditCardCycle & { estimatedStatementBalanceMinor?: number }).estimatedStatementBalanceMinor ?? 0,
     statementExpected: row.statementId == null && row.statementDate <= new Date().toISOString().slice(0, 10),
  }));
}

export type CreditCardCycleTransaction = {
  id: string;
  transaction_type: string;
  transaction_date: string;
  amount_centavos: number;
  merchant_name: string | null;
  counterparty_name: string | null;
  purchase_type: "regular" | "installment";
};

export async function listCreditCardCycleTransactions(
  userId: string,
  cycleId: string,
): Promise<CreditCardCycleTransaction[]> {
  const db = await getDb();
  return db.getAllAsync<CreditCardCycleTransaction>(
    `SELECT t.id,t.transaction_type,t.transaction_date,t.amount_centavos,t.merchant_name,t.counterparty_name,ct.purchase_type
     FROM credit_card_transactions ct
     JOIN transactions t ON t.id=ct.transaction_id AND t.user_id=ct.user_id AND t.deleted=0
     WHERE ct.cycle_id=? AND ct.user_id=? AND ct.deleted=0
     ORDER BY t.transaction_date DESC,t.created_at DESC`,
    cycleId,
    userId,
  );
}

export async function listCreditCardInstallments(userId: string, accountId: string): Promise<CreditCardInstallment[]> {
  const db = await getDb();
  return db.getAllAsync<CreditCardInstallment>(
    `SELECT id,account_id AS accountId,transaction_id AS transactionId,description,
      original_principal_centavos AS originalPrincipalMinor,remaining_principal_centavos AS remainingPrincipalMinor,
      term_months AS termMonths,remaining_months AS remainingMonths,monthly_amortization_centavos AS monthlyAmortizationMinor,
      interest_rate_bps AS interestRateBps,interest_type AS interestType,settlement_status AS settlementStatus
      FROM credit_card_installments WHERE account_id=? AND user_id=? AND deleted=0 ORDER BY created_at DESC`,
    accountId,
    userId,
  );
}

export async function listCreditCardPayments(userId: string, cycleId: string): Promise<CreditCardPayment[]> {
  const db = await getDb();
  return db.getAllAsync<CreditCardPayment>(
    `SELECT id,cycle_id AS cycleId,statement_id AS statementId,transaction_id AS transactionId,
      amount_centavos AS amountMinor,payment_date AS paymentDate,issuer_recognized AS issuerRecognized
      FROM credit_card_payments WHERE cycle_id=? AND user_id=? AND deleted=0 ORDER BY payment_date DESC,created_at DESC`,
    cycleId,
    userId,
  ).then((rows) => rows.map((row) => ({ ...row, issuerRecognized: Boolean(row.issuerRecognized) })));
}

export async function listCreditCardSettlements(userId: string, accountId: string): Promise<CreditCardSettlement[]> {
  const db = await getDb();
  return db.getAllAsync<CreditCardSettlement>(
    `SELECT s.id,s.installment_id AS installmentId,s.settlement_date AS settlementDate,
      s.settlement_amount_centavos AS settlementAmountMinor,s.status
      FROM credit_card_settlements s JOIN credit_card_installments i ON i.id=s.installment_id
      AND i.user_id=s.user_id AND i.deleted=0
      WHERE i.account_id=? AND s.user_id=? AND s.deleted=0
      ORDER BY s.settlement_date DESC,s.created_at DESC`,
    accountId,
    userId,
  );
}

export async function applyCreditCardBalance(
  userId: string,
  deviceId: string,
  input: { paymentId: string; targetTransactionId: string; amountMinor: number; appliedDate: string; clientMutationId?: string },
) {
  money(input.amountMinor, "amountMinor", true);
  date(input.appliedDate, "appliedDate");
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    if (input.clientMutationId && await db.getFirstAsync("SELECT id FROM credit_card_credit_applications WHERE user_id=? AND client_mutation_id=? AND deleted=0", userId, input.clientMutationId)) return;
    const payment = await db.getFirstAsync<{ accountId: string; amountMinor: number; statementBalanceMinor: number | null }>(
      `SELECT c.account_id AS accountId,p.amount_centavos AS amountMinor,s.statement_balance_centavos AS statementBalanceMinor
       FROM credit_card_payments p JOIN credit_card_cycles c ON c.id=p.cycle_id
       LEFT JOIN credit_card_statements s ON s.id=p.statement_id
       WHERE p.id=? AND p.user_id=? AND p.deleted=0`, input.paymentId, userId,
    );
    if (!payment) throw new LocalDbError("NOT_FOUND", "Credit-card payment not found");
    const applied = await db.getFirstAsync<{ total: number }>("SELECT COALESCE(SUM(amount_centavos),0) AS total FROM credit_card_credit_applications WHERE payment_id=? AND user_id=? AND deleted=0", input.paymentId, userId);
    const available = Math.max(0, payment.amountMinor - (payment.statementBalanceMinor ?? 0) - (applied?.total ?? 0));
    if (input.amountMinor > available) throw new LocalDbError("VALIDATION_ERROR", "Application exceeds the available credit balance");
    const target = await db.getFirstAsync<{ id: string; applied: number; amount: number }>(
      `SELECT ct.transaction_id AS id,ct.applied_credit_centavos AS applied,t.amount_centavos AS amount FROM credit_card_transactions ct
       JOIN transactions t ON t.id=ct.transaction_id AND t.user_id=ct.user_id AND t.deleted=0
       WHERE ct.transaction_id=? AND ct.user_id=? AND ct.account_id=? AND ct.deleted=0`,
      input.targetTransactionId, userId, payment.accountId,
    );
    if (!target) throw new LocalDbError("NOT_FOUND", "Target credit-card transaction not found");
    if (input.amountMinor > target.amount - target.applied) throw new LocalDbError("VALIDATION_ERROR", "Application exceeds the target charge");
    const id = randomUUID(); const now = new Date().toISOString();
    await db.runAsync("INSERT INTO credit_card_credit_applications(id,user_id,account_id,payment_id,amount_centavos,applied_date,target_transaction_id,client_mutation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", id, userId, payment.accountId, input.paymentId, input.amountMinor, input.appliedDate, input.targetTransactionId, input.clientMutationId ?? null, now, now);
    await db.runAsync("UPDATE credit_card_transactions SET applied_credit_centavos=applied_credit_centavos+?,updated_at=? WHERE transaction_id=? AND user_id=?", input.amountMinor, now, input.targetTransactionId, userId);
    const balanceUpdate = await db.runAsync("UPDATE credit_card_details SET available_credit_centavos=MIN(credit_limit_centavos,COALESCE(available_credit_centavos,credit_limit_centavos)+?),version=version+1,updated_at=? WHERE account_id=? AND user_id=? AND deleted=0", input.amountMinor, now, payment.accountId, userId);
    if (balanceUpdate.changes !== 1) throw new LocalDbError("NOT_FOUND", "Credit-card details not found");
    await operation(db, userId, deviceId, "credit_card_credit_applications", id, { account_id: payment.accountId, payment_id: input.paymentId, amount_centavos: input.amountMinor, applied_date: input.appliedDate, target_transaction_id: input.targetTransactionId, client_mutation_id: input.clientMutationId ?? null });
  });
}

export async function requestCreditCardSettlement(userId: string, deviceId: string, input: { installmentId: string; settlementDate: string; remainingPrincipalMinor: number; settlementAmountMinor: number; preterminationFeeMinor?: number }) {
  date(input.settlementDate, "settlementDate"); money(input.remainingPrincipalMinor, "remainingPrincipalMinor"); money(input.settlementAmountMinor, "settlementAmountMinor", true); money(input.preterminationFeeMinor ?? 0, "preterminationFeeMinor");
  const db = await getDb(); const installment = await db.getFirstAsync<{ version: number; accountId: string }>("SELECT version,account_id AS accountId FROM credit_card_installments WHERE id=? AND user_id=? AND deleted=0", input.installmentId, userId);
  if (!installment) throw new LocalDbError("NOT_FOUND", "Installment not found");
  const id = randomUUID(); const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE credit_card_installments SET settlement_status='settlement_requested',version=version+1,updated_at=? WHERE id=? AND user_id=?", now, input.installmentId, userId);
    await db.runAsync("INSERT INTO credit_card_settlements(id,user_id,installment_id,settlement_date,remaining_principal_centavos,settlement_amount_centavos,pretermination_fee_centavos,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", id, userId, input.installmentId, input.settlementDate, input.remainingPrincipalMinor, input.settlementAmountMinor, input.preterminationFeeMinor ?? 0, "requested", now, now);
    await operation(db, userId, deviceId, "credit_card_settlements", id, { installment_id: input.installmentId, settlement_date: input.settlementDate, remaining_principal_centavos: input.remainingPrincipalMinor, settlement_amount_centavos: input.settlementAmountMinor, pretermination_fee_centavos: input.preterminationFeeMinor ?? 0, status: "requested" });
  });
  return id;
}

export async function recognizeCreditCardSettlement(userId: string, deviceId: string, settlementId: string) {
  const db = await getDb(); let result!: SyncOperation;
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ installmentId: string; version: number }>("SELECT installment_id AS installmentId,version FROM credit_card_settlements WHERE id=? AND user_id=? AND deleted=0 AND status='requested'", settlementId, userId);
    if (!row) throw new LocalDbError("NOT_FOUND", "Settlement request not found");
    const now = new Date().toISOString();
    await db.runAsync("UPDATE credit_card_settlements SET status='recognized',version=version+1,updated_at=? WHERE id=? AND user_id=?", now, settlementId, userId);
    await db.runAsync("UPDATE credit_card_installments SET settlement_status='completed',remaining_principal_centavos=0,remaining_months=0,version=version+1,updated_at=? WHERE id=? AND user_id=?", now, row.installmentId, userId);
    result = await operation(db, userId, deviceId, "credit_card_settlements", settlementId, { status: "recognized" }, ["status"], "update", row.version);
  });
  return result;
}

export async function recordCreditCardPayment(
  userId: string,
  deviceId: string,
  input: PaymentInput,
) {
  money(input.amountMinor, "amountMinor", true);
  date(input.paymentDate, "paymentDate");
  const db = await getDb();
  let result!: {
    paymentId: string;
    operation: SyncOperation;
    status: string;
    creditBalanceMinor: number;
  };
  await db.withTransactionAsync(async () => {
    if (input.clientMutationId) {
      const existing = await db.getFirstAsync<{ id: string }>("SELECT id FROM credit_card_payments WHERE user_id=? AND client_mutation_id=? AND deleted=0", userId, input.clientMutationId);
       if (existing) { result = { paymentId: existing.id, operation: {} as SyncOperation, status: "partially_paid", creditBalanceMinor: 0 }; return; }
    }
    await owned(
      db,
      "credit_card_cycles",
      input.cycleId,
      userId,
      "Billing cycle not found",
    );
    const cycle = await db.getFirstAsync<{ account_id: string }>(
      "SELECT account_id FROM credit_card_cycles WHERE id=? AND user_id=? AND deleted=0",
      input.cycleId,
      userId,
    );
    if (!cycle) throw new LocalDbError("NOT_FOUND", "Billing cycle not found");
    if (input.statementId) {
      const statement = await db.getFirstAsync<{ cycle_id: string }>(
        "SELECT cycle_id FROM credit_card_statements WHERE id=? AND user_id=? AND deleted=0",
        input.statementId,
        userId,
      );
      if (!statement) throw new LocalDbError("NOT_FOUND", "Statement not found");
      if (statement.cycle_id !== input.cycleId) throw new LocalDbError("VALIDATION_ERROR", "Statement must belong to the selected billing cycle");
    }
    if (input.sourceAccountId && !input.subcategoryId) {
      throw new LocalDbError(
        "VALIDATION_ERROR",
        "Payment category is required when recording a related transaction",
      );
    }
    if (input.sourceAccountId) {
      const source = await db.getFirstAsync<{ id: string }>("SELECT id FROM financial_accounts WHERE id=? AND user_id=? AND status='active' AND deleted=0 AND kind<>'credit_card'", input.sourceAccountId, userId);
      if (!source) throw new LocalDbError("VALIDATION_ERROR", "Payment source account must be an active non-credit-card account");
    }
    let transactionId: string | null = null;
    if (input.sourceAccountId && input.subcategoryId) {
      transactionId = (await createExpenseInTransaction(db, userId, deviceId, {
        amount_centavos: input.amountMinor,
        source_account_id: input.sourceAccountId,
        subcategory_id: input.subcategoryId,
        transaction_date: input.paymentDate,
        client_mutation_id: input.clientMutationId ? `credit-card-payment:${input.clientMutationId}` : undefined,
        notes: input.notes,
      })).transaction.id;
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    await db.runAsync(
      "INSERT INTO credit_card_payments(id,user_id,cycle_id,statement_id,transaction_id,amount_centavos,payment_date,source_account_id,notes,client_mutation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      userId,
      input.cycleId,
      input.statementId ?? null,
      transactionId,
      input.amountMinor,
      input.paymentDate,
      transactionId ? input.sourceAccountId : null,
      input.notes ?? null,
      input.clientMutationId ?? null,
      now,
      now,
    );
    const op = await operation(
      db,
      userId,
      deviceId,
      "credit_card_payments",
      id,
      {
        cycle_id: input.cycleId,
        statement_id: input.statementId ?? null,
        transaction_id: transactionId,
        amount_centavos: input.amountMinor,
        payment_date: input.paymentDate,
        source_account_id: transactionId ? input.sourceAccountId : null,
        notes: input.notes ?? null,
        issuer_recognized: false,
        client_mutation_id: input.clientMutationId ?? null,
      },
    );
    const statement = input.statementId
      ? await db.getFirstAsync<Statement>(
        "SELECT statement_balance_centavos AS statementBalanceMinor,minimum_due_centavos AS minimumDueMinor,authoritative FROM credit_card_statements WHERE id=?",
        input.statementId,
      )
      : null;
    const paid = statement
      ? (await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(amount_centavos),0) AS total FROM credit_card_payments WHERE cycle_id=? AND user_id=? AND deleted=0",
        input.cycleId,
        userId,
      ))?.total ?? 0
      : 0;
    result = {
      paymentId: id,
      operation: op,
      status: statement
        ? statementPaymentStatus(statement, paid)
         : "partially_paid",
      creditBalanceMinor: statement
        ? creditBalance(paid, statement.statementBalanceMinor)
        : 0,
    };
  });
  return result;
}

export async function recognizeCreditCardPayment(userId: string, deviceId: string, paymentId: string) {
  const db = await getDb();
  let result!: SyncOperation;
  await db.withTransactionAsync(async () => {
    const payment = await db.getFirstAsync<{ version: number; issuerRecognized: number; amount: number; accountId: string; cycleId: string; transactionId: string | null }>(
      "SELECT p.version,p.issuer_recognized AS issuerRecognized,p.amount_centavos AS amount,p.cycle_id AS cycleId,p.transaction_id AS transactionId,c.account_id AS accountId FROM credit_card_payments p JOIN credit_card_cycles c ON c.id=p.cycle_id AND c.user_id=p.user_id WHERE p.id=? AND p.user_id=? AND p.deleted=0",
      paymentId,
      userId,
    );
    if (!payment) throw new LocalDbError("NOT_FOUND", "Credit-card payment not found");
    if (payment.issuerRecognized) return;
    const now = new Date().toISOString();
    await db.runAsync("UPDATE credit_card_payments SET issuer_recognized=1,version=version+1,updated_at=? WHERE id=? AND user_id=? AND issuer_recognized=0", now, paymentId, userId);
    const cardUpdate = await db.runAsync("UPDATE credit_card_details SET available_credit_centavos=MIN(credit_limit_centavos,COALESCE(available_credit_centavos,credit_limit_centavos)+?),version=version+1,updated_at=? WHERE account_id=? AND user_id=? AND deleted=0", payment.amount, now, payment.accountId, userId);
    if (cardUpdate.changes !== 1) throw new LocalDbError("NOT_FOUND", "Credit-card details not found");
    await db.runAsync("UPDATE credit_card_installments SET remaining_principal_centavos=MAX(0,remaining_principal_centavos-monthly_amortization_centavos),remaining_months=MAX(0,remaining_months-1),settlement_status=CASE WHEN remaining_months<=1 THEN 'completed' ELSE settlement_status END,version=version+1,updated_at=? WHERE id IN (SELECT installment_id FROM credit_card_transactions WHERE cycle_id=? AND user_id=? AND installment_id IS NOT NULL AND deleted=0) AND user_id=? AND deleted=0 AND settlement_status='active'", now, payment.cycleId, userId, userId);
    result = await operation(db, userId, deviceId, "credit_card_payments", paymentId, { issuer_recognized: true }, ["issuer_recognized"], "update", payment.version);
  });
  return result;
}

export async function setCreditCardStatementStrategy(
  userId: string,
  deviceId: string,
  statementId: string,
  strategy: "pay_full" | "pay_minimum" | "custom",
  customMinor?: number,
) {
  const db = await getDb();
  const statement = await db.getFirstAsync<Statement>(
    "SELECT statement_balance_centavos AS statementBalanceMinor,minimum_due_centavos AS minimumDueMinor,authoritative FROM credit_card_statements WHERE id=? AND user_id=? AND deleted=0",
    statementId,
    userId,
  );
  if (!statement) throw new LocalDbError("NOT_FOUND", "Statement not found");
  const target = validateStatementStrategy(strategy, customMinor, statement);
  const current = await db.getFirstAsync<{ version: number }>(
    "SELECT version FROM credit_card_statement_strategies WHERE statement_id=? AND user_id=? AND deleted=0",
    statementId,
    userId,
  );
  const now = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO credit_card_statement_strategies(statement_id,user_id,strategy,custom_amount_centavos,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(statement_id) DO UPDATE SET strategy=excluded.strategy,custom_amount_centavos=excluded.custom_amount_centavos,deleted=0,version=credit_card_statement_strategies.version+1,updated_at=excluded.updated_at",
    statementId,
    userId,
    strategy,
    strategy === "custom" ? target : null,
    now,
    now,
  );
  return operation(
    db,
    userId,
    deviceId,
    "credit_card_statement_strategies",
    statementId,
    {
      statement_id: statementId,
      strategy,
      custom_amount_centavos: strategy === "custom" ? target : null,
    },
    ["strategy", "custom_amount_centavos"],
    current ? "update" : "create",
    current?.version ?? null,
  );
}
export async function getCreditCardDebtBudgetRequirement(
  userId: string,
  periodStart: string,
  periodEnd: string,
) {
  const db = await getDb();
  const rows = await db.getAllAsync<
    {
      statement_balance_centavos: number;
      minimum_due_centavos: number;
      strategy: string | null;
      custom_amount_centavos: number | null;
    }
  >(
    "SELECT s.statement_balance_centavos,s.minimum_due_centavos,st.strategy,st.custom_amount_centavos FROM credit_card_statements s JOIN credit_card_cycles c ON c.id=s.cycle_id AND c.user_id=s.user_id AND c.deleted=0 JOIN financial_accounts a ON a.id=c.account_id AND a.user_id=c.user_id AND a.deleted=0 AND a.status='active' AND a.kind='credit_card' LEFT JOIN credit_card_statement_strategies st ON st.statement_id=s.id AND st.user_id=s.user_id AND st.deleted=0 WHERE s.user_id=? AND s.deleted=0 AND s.authoritative=1 AND s.due_date BETWEEN ? AND ?",
    userId,
    periodStart,
    periodEnd,
  );
  return rows.reduce((result, row) => {
    result.statementBalanceMinor += row.statement_balance_centavos;
    if (
      !row.strategy ||
      (row.strategy === "custom" && row.custom_amount_centavos == null)
    ) {
      return {
        ...result,
        missingStrategyCount: result.missingStrategyCount + 1,
        strategyRequired: true,
      };
    }
    const amount = row.strategy === "pay_full"
      ? row.statement_balance_centavos
      : row.strategy === "pay_minimum"
      ? row.minimum_due_centavos
      : row.custom_amount_centavos;
    if (amount == null) {
      return {
        ...result,
        missingStrategyCount: result.missingStrategyCount + 1,
        strategyRequired: true,
      };
    }
    return { ...result, requiredMinor: result.requiredMinor + amount };
  }, { requiredMinor: 0, statementBalanceMinor: 0, missingStrategyCount: 0, strategyRequired: false });
}
export { creditBalance, routePostingDate, statementPaymentStatus };
