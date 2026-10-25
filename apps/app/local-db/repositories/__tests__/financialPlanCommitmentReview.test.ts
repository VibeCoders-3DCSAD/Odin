import { jest } from "@jest/globals";
import { DatabaseSync } from "node:sqlite";
import financialPlansMigration from "../../migrations/066_financial_plans";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
jest.mock("../../client", () => ({ initDatabase: () => mockInitDatabase() }));

const USER = "user-1";
const OTHER_USER = "user-2";
const TS = "2026-09-01T00:00:00.000Z";

// Column definitions mirror migrations 019, 024 and 053; plan tables come from migration 066 itself.
const ACTUALS_SCHEMA = `
  CREATE TABLE savings_goal_activities (
    id text primary key, user_id text not null, savings_goal_id text not null,
    transaction_id text not null, activity_kind text not null,
    amount_centavos integer not null, activity_date text not null, notes text,
    version integer not null default 1, deleted integer not null default 0,
    created_at text not null, updated_at text not null, last_synced_at text,
    CHECK (activity_kind IN ('contribution', 'withdrawal')), CHECK (amount_centavos > 0)
  );
  CREATE TABLE debt_payments (
    id text primary key, debt_account_id text not null, user_id text not null,
    transaction_id text, source text not null default 'manual', payment_date text not null,
    amount_centavos integer not null, principal_centavos integer, interest_centavos integer,
    notes text, version integer not null default 1, deleted integer not null default 0,
    created_at text not null, updated_at text not null, last_synced_at text
  );
  CREATE TABLE credit_card_payments (
    id text primary key, user_id text not null, cycle_id text not null, statement_id text, transaction_id text,
    amount_centavos integer not null, payment_date text not null, source_account_id text, notes text,
    version integer not null default 1, deleted integer not null default 0, created_at text not null, updated_at text not null, last_synced_at text
  );
  CREATE TABLE scheduled_payment_records (
    id text primary key, user_id text not null, scheduled_payment_id text not null, transaction_id text not null,
    occurrence_date text not null, payment_date text not null, amount_centavos integer not null, source text not null default 'manual', notes text, settles_occurrence integer not null default 0,
    version integer not null default 1, deleted integer not null default 0, created_at text not null, updated_at text not null, last_synced_at text
  );`;

function createDb() {
  const sqlite = new DatabaseSync(":memory:");
  const db = {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    getFirstAsync: async (sql: string, ...params: any[]) => sqlite.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, ...params: any[]) => sqlite.prepare(sql).all(...params),
  };
  const run = (sql: string, ...params: any[]) => sqlite.prepare(sql).run(...params);
  return { db, run };
}

type Run = ReturnType<typeof createDb>["run"];
let idSeq = 0;
const nextId = (prefix: string) => `${prefix}-${++idSeq}`;

function insertPlan(run: Run, id: string, { userId = USER, status = "accepted", deleted = 0 } = {}) {
  run(
    "INSERT INTO financial_plans (id, user_id, period_start, period_end, status, forecast_month, forecast_total_centavos, forecast_model_version, forecast_generated_at, forecast_quality, available_funds_centavos, deleted, created_at, updated_at) VALUES (?, ?, '2026-09-01', '2026-09-30', ?, '2026-09', 0, 'v1', ?, 'FALLBACK', 0, ?, ?, ?)",
    id, userId, status, TS, deleted, TS, TS,
  );
}
const savingsReservation = (run: Run, planId: string, goalId: string, amount: number, dueDate: string | null) =>
  run("INSERT INTO financial_plan_savings_reservations (id, plan_id, savings_goal_id, amount_centavos, due_date) VALUES (?, ?, ?, ?, ?)", nextId("sr"), planId, goalId, amount, dueDate);
const debtReservation = (run: Run, planId: string, target: { debt?: string; statement?: string }, amount: number, dueDate: string | null) =>
  run("INSERT INTO financial_plan_debt_reservations (id, plan_id, debt_account_id, credit_card_statement_id, amount_centavos, due_date) VALUES (?, ?, ?, ?, ?, ?)", nextId("dr"), planId, target.debt ?? null, target.statement ?? null, amount, dueDate);
const activity = (run: Run, goalId: string, amount: number, date: string, { kind = "contribution", userId = USER, deleted = 0 } = {}) =>
  run("INSERT INTO savings_goal_activities (id, user_id, savings_goal_id, transaction_id, activity_kind, amount_centavos, activity_date, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", nextId("sa"), userId, goalId, nextId("tx"), kind, amount, date, deleted, TS, TS);
const debtPayment = (run: Run, debtId: string, amount: number, date: string, { userId = USER, deleted = 0 } = {}) =>
  run("INSERT INTO debt_payments (id, debt_account_id, user_id, payment_date, amount_centavos, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", nextId("dp"), debtId, userId, date, amount, deleted, TS, TS);
const cardPayment = (run: Run, statementId: string | null, amount: number, date: string, { userId = USER, deleted = 0 } = {}) =>
  run("INSERT INTO credit_card_payments (id, user_id, cycle_id, statement_id, amount_centavos, payment_date, deleted, created_at, updated_at) VALUES (?, ?, 'cycle-1', ?, ?, ?, ?, ?, ?)", nextId("cp"), userId, statementId, amount, date, deleted, TS, TS);

async function setup() {
  const { db, run } = createDb();
  await financialPlansMigration.up(db as any);
  await db.execAsync(ACTUALS_SCHEMA);
  mockInitDatabase.mockResolvedValue(db);
  const { getPlanCommitmentPayments, getPlanCommitmentReview } = await import("../financialPlanCommitmentReview");
  return { run, review: (planId = "plan-1", userId = USER) => getPlanCommitmentReview(userId, planId), payments: () => getPlanCommitmentPayments(USER, { start: "2026-09-01", end: "2026-09-30" }) };
}

describe("getPlanCommitmentReview", () => {
  beforeEach(() => { jest.resetModules(); mockInitDatabase.mockReset(); });

  it("returns null when the plan is missing, not accepted, deleted or owned by another user", async () => {
    const { run, review } = await setup();
    insertPlan(run, "plan-draft", { status: "draft" });
    insertPlan(run, "plan-deleted", { deleted: 1 });
    insertPlan(run, "plan-other", { userId: OTHER_USER });

    await expect(review("missing")).resolves.toBeNull();
    await expect(review("plan-draft")).resolves.toBeNull();
    await expect(review("plan-deleted")).resolves.toBeNull();
    await expect(review("plan-other")).resolves.toBeNull();
  });

  it("compares savings contributions per goal, summing reservations and ignoring withdrawals", async () => {
    const { run, review } = await setup();
    insertPlan(run, "plan-1");
    savingsReservation(run, "plan-1", "goal-met", 1_000, "2026-09-20");
    savingsReservation(run, "plan-1", "goal-met", 500, "2026-09-05");
    savingsReservation(run, "plan-1", "goal-partial", 2_000, "2026-09-10");
    savingsReservation(run, "plan-1", "goal-none", 700, null);
    activity(run, "goal-met", 1_200, "2026-09-01");
    activity(run, "goal-met", 800, "2026-09-30");
    activity(run, "goal-met", 5_000, "2026-09-15", { kind: "withdrawal" });
    activity(run, "goal-partial", 600, "2026-09-12");
    activity(run, "goal-partial", 900, "2026-08-31");
    activity(run, "goal-partial", 900, "2026-10-01");
    activity(run, "goal-partial", 900, "2026-09-12", { deleted: 1 });
    activity(run, "goal-partial", 900, "2026-09-12", { userId: OTHER_USER });
    activity(run, "goal-none", 300, "2026-09-12", { kind: "withdrawal" });
    activity(run, "goal-extra", 400, "2026-09-18");
    activity(run, "goal-withdrawn", 400, "2026-09-18", { kind: "withdrawal" });

    const result = await review();

    expect(result?.savings).toEqual([
      { savingsGoalId: "goal-met", reservedCentavos: 1_500, actualCentavos: 2_000, additionalCentavos: 500, status: "met", dueDate: "2026-09-05" },
      { savingsGoalId: "goal-partial", reservedCentavos: 2_000, actualCentavos: 600, additionalCentavos: 0, status: "partial", dueDate: "2026-09-10" },
      { savingsGoalId: "goal-none", reservedCentavos: 700, actualCentavos: 0, additionalCentavos: 0, status: "not_recorded", dueDate: null },
      { savingsGoalId: "goal-extra", reservedCentavos: 0, actualCentavos: 400, additionalCentavos: 400, status: "unplanned", dueDate: null },
    ]);
    expect(result?.totals).toMatchObject({ savingsReservedCentavos: 4_200, savingsActualCentavos: 3_000, savingsAdditionalCentavos: 900 });
  });

  it("matches debt accounts and credit-card statements and flags unplanned payments", async () => {
    const { run, review } = await setup();
    insertPlan(run, "plan-1");
    insertPlan(run, "plan-2");
    debtReservation(run, "plan-1", { debt: "debt-loan" }, 3_000, "2026-09-15");
    debtReservation(run, "plan-1", { statement: "stmt-1" }, 2_000, "2026-09-08");
    debtReservation(run, "plan-1", { statement: "stmt-unpaid" }, 1_000, "2026-09-25");
    debtReservation(run, "plan-2", { statement: "stmt-other-plan" }, 9_000, "2026-09-01");
    debtPayment(run, "debt-loan", 3_500, "2026-09-14");
    debtPayment(run, "debt-loan", 1_000, "2026-10-02");
    debtPayment(run, "debt-loan", 1_000, "2026-09-14", { deleted: 1 });
    debtPayment(run, "debt-loan", 1_000, "2026-09-14", { userId: OTHER_USER });
    debtPayment(run, "debt-extra", 250, "2026-09-03");
    cardPayment(run, "stmt-1", 1_500, "2026-09-07");
    cardPayment(run, "stmt-1", 999, "2026-09-07", { deleted: 1 });
    cardPayment(run, "stmt-other-plan", 600, "2026-09-09");
    cardPayment(run, null, 777, "2026-09-09");

    const result = await review();

    expect(result?.debts).toEqual([
      { debtAccountId: null, creditCardStatementId: "stmt-1", reservedCentavos: 2_000, actualCentavos: 1_500, additionalCentavos: 0, status: "partial", dueDate: "2026-09-08" },
      { debtAccountId: "debt-loan", creditCardStatementId: null, reservedCentavos: 3_000, actualCentavos: 3_500, additionalCentavos: 500, status: "met", dueDate: "2026-09-15" },
      { debtAccountId: null, creditCardStatementId: "stmt-unpaid", reservedCentavos: 1_000, actualCentavos: 0, additionalCentavos: 0, status: "not_recorded", dueDate: "2026-09-25" },
      { debtAccountId: "debt-extra", creditCardStatementId: null, reservedCentavos: 0, actualCentavos: 250, additionalCentavos: 250, status: "unplanned", dueDate: null },
      { debtAccountId: null, creditCardStatementId: "stmt-other-plan", reservedCentavos: 0, actualCentavos: 600, additionalCentavos: 600, status: "unplanned", dueDate: null },
    ]);
    expect(result?.totals).toEqual({
      savingsReservedCentavos: 0, savingsActualCentavos: 0, savingsAdditionalCentavos: 0,
      debtReservedCentavos: 6_000, debtActualCentavos: 5_850, debtAdditionalCentavos: 1_350,
    });
  });
});

const billerPayment = (run: Run, scheduledId: string, amount: number, occurrenceDate: string, { userId = USER, deleted = 0, settles = 0 } = {}) =>
  run("INSERT INTO scheduled_payment_records (id, user_id, scheduled_payment_id, transaction_id, occurrence_date, payment_date, amount_centavos, settles_occurrence, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", nextId("spr"), userId, scheduledId, nextId("tx"), occurrenceDate, occurrenceDate, amount, settles, deleted, TS, TS);

describe("getPlanCommitmentPayments", () => {
  beforeEach(() => { jest.resetModules(); mockInitDatabase.mockReset(); });

  it("totals period payments per goal and debt, statement payments on any date, and biller payments per occurrence", async () => {
    const { run, payments } = await setup();
    activity(run, "goal-1", 400, "2026-09-03");
    activity(run, "goal-1", 600, "2026-09-20");
    activity(run, "goal-1", 900, "2026-08-31");
    activity(run, "goal-1", 900, "2026-09-10", { kind: "withdrawal" });
    debtPayment(run, "debt-1", 2_000, "2026-09-15");
    debtPayment(run, "debt-1", 2_000, "2026-09-15", { deleted: 1 });
    cardPayment(run, "stmt-1", 1_500, "2026-08-29");
    cardPayment(run, null, 777, "2026-09-09");
    billerPayment(run, "bill-1", 1_000, "2026-09-05");
    billerPayment(run, "bill-1", 300, "2026-09-19");
    billerPayment(run, "bill-1", 300, "2026-10-03");
    billerPayment(run, "bill-1", 500, "2026-09-05", { userId: OTHER_USER });

    await expect(payments()).resolves.toEqual({
      paidCentavos: {
        "savings:goal-1": 1_000,
        "debt:debt-1": 2_000,
        "statement:stmt-1": 1_500,
        "scheduled:bill-1:2026-09-05": 1_000,
        "scheduled:bill-1:2026-09-19": 300,
      },
      settledKeys: [],
    });
  });

  it("reports biller occurrences marked as paid without changing their paid amount", async () => {
    const { run, payments } = await setup();
    billerPayment(run, "bill-1", 1_000, "2026-09-05");
    billerPayment(run, "bill-1", 800, "2026-09-05", { settles: 1 });
    billerPayment(run, "bill-1", 1_800, "2026-09-19");

    await expect(payments()).resolves.toEqual({
      paidCentavos: { "scheduled:bill-1:2026-09-05": 1_800, "scheduled:bill-1:2026-09-19": 1_800 },
      settledKeys: ["scheduled:bill-1:2026-09-05"],
    });
  });
});
