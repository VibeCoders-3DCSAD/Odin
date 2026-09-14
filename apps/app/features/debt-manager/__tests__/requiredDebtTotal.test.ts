import { getRequiredDebtTotal, type RequiredDebtTotalInput } from "../requiredDebtTotal";
import type { CreditCardCycle } from "../../../local-db/repositories/creditCardCycles";
import type { CreditCardCycleTransaction } from "../../../local-db/repositories/creditCardCycles";
import type { CreditCardPayment } from "../../../local-db/repositories/creditCardPayments";
import type { CreditCardStrategy } from "../../../local-db/repositories/creditCardRepaymentPlans";
import type { CreditCardStatement } from "../../../local-db/repositories/creditCardStatements";
import type { FinancialAccount } from "../../../local-db/repositories/financialFoundations";
import type { DebtAccount, PaymentFrequency } from "../../../local-db/repositories/debtAccounts";
import type { DebtPayment } from "../../../local-db/repositories/debtPayments";

function input(overrides: Partial<RequiredDebtTotalInput> = {}): RequiredDebtTotalInput {
  return {
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    debts: [],
    creditCards: [],
    creditCardCycles: [],
    creditCardCycleTransactions: [],
    creditCardStatements: [],
    creditCardStrategies: [],
    creditCardPayments: [],
    debtPayments: [],
    ...overrides,
  };
}

function debtPayment(debtAccountId: string, amountCentavos: number, paymentDate = "2026-04-10"): DebtPayment {
  return { id: `payment-${debtAccountId}`, debt_account_id: debtAccountId, transaction_id: "transaction-1", payment_date: paymentDate, amount_centavos: amountCentavos, principal_centavos: amountCentavos, interest_centavos: 0, notes: null, version: 1 };
}

function card(id: string): FinancialAccount {
  return {
    id,
    name: id,
    kind: "credit_card",
    status: "active",
    openingBalanceCentavos: 0,
    currentBalanceCentavos: 0,
    includeInDashboardBalance: false,
    institutionName: null,
    openedOn: null,
    archivedAt: null,
    sortOrder: 0,
    creditCardDetails: null,
  };
}

function cycle(id: string, accountId: string, userId = "user-1"): CreditCardCycle {
  return { id, user_id: userId, account_id: accountId, cycle_start_date: "2026-03-01", cutoff_date: "2026-03-31", statement_date: "2026-04-01", version: 1, deleted: false, created_at: "", updated_at: "" };
}

function statement(id: string, cycleId: string, dueDate = "2026-04-15"): CreditCardStatement {
  return { id, user_id: "user-1", cycle_id: cycleId, statement_date: "2026-04-01", statement_balance_centavos: 10_000, minimum_due_centavos: 2_000, finance_charge_centavos: 0, due_date: dueDate, authoritative: true, version: 1, deleted: false, created_at: "", updated_at: "" };
}

function strategy(accountId: string, value: CreditCardStrategy["strategy"], customAmountCentavos: number | null = null, percentageBps: number | null = null): CreditCardStrategy {
  return { accountId, strategy: value, customAmountCentavos, percentageBps, version: 1 };
}

function payment(statementId: string, cycleId: string, amountCentavos: number, paymentDate = "2026-04-10"): CreditCardPayment {
  return { id: `payment-${statementId}`, user_id: "user-1", cycle_id: cycleId, statement_id: statementId, transaction_id: "transaction-1", amount_centavos: amountCentavos, payment_date: paymentDate, forecast_recorded_at: null, source_account_id: "source-1", notes: null, issuer_recognized: false, client_mutation_id: "mutation-1", version: 1, deleted: false, created_at: "", updated_at: "" };
}

function debt(id: string, paymentFrequency: PaymentFrequency, nextDueDate: string, balance = 10_000, minimumPayment = 1_000): DebtAccount {
  return {
    id, name: id, lenderName: "Lender", type: "personal_loan", status: "active", progress: "on_schedule",
    originalBalanceCentavos: balance, currentBalanceCentavos: balance, annualInterestRateBps: 0,
    minimumPaymentCentavos: minimumPayment, paymentFrequency, nextDueDate, maturityDate: null,
    targetPayoffDate: "2027-01-01", interestPeriod: "none", interestMethod: "no_interest", notes: null,
    typeSpecific: { startDate: "2026-01-01", feesCentavos: 0, penaltyInfo: null, termMonths: null }, paymentSchedule: {},
    hasPaymentHistory: false, archivedAt: null, paidOffAt: null, version: 1,
  };
}

function cycleTransaction(cycleId: string, amountCentavos: number, transactionDate = "2026-09-07"): CreditCardCycleTransaction {
  return { transaction_id: `transaction-${cycleId}`, account_id: "card-1", cycle_id: cycleId, purchase_type: "regular", installment_id: null, transaction_date: transactionDate, merchant_name: "Merchant", amount_centavos: amountCentavos };
}

describe("getRequiredDebtTotal", () => {
  it("returns a centavo-safe total and obligation breakdown", () => {
    expect(getRequiredDebtTotal(input())).toEqual({
      totalRequiredCentavos: 0,
      obligations: [],
    });
  });

  it.each(["2026-4-01", "2026-02-30", "April 1, 2026"])("rejects an invalid ISO date: %s", (periodStart) => {
    expect(() => getRequiredDebtTotal(input({ periodStart }))).toThrow(
      "periodStart and periodEnd must use valid YYYY-MM-DD dates",
    );
  });

  it("rejects an inverted date range", () => {
    expect(() => getRequiredDebtTotal(input({ periodStart: "2026-05-01", periodEnd: "2026-04-30" }))).toThrow(
      "periodStart must be on or before periodEnd",
    );
  });

  it.each([
    [strategy("card-1", "pay_in_full"), 10_000],
    [strategy("card-1", "pay_minimum"), 2_000],
    [strategy("card-1", "percentage_of_statement", null, 2_500), 2_500],
    [strategy("card-1", "custom_payment", 3_000), 3_000],
  ] as const)("uses the saved %s strategy target", (creditCardStrategy, expectedTarget) => {
    const result = getRequiredDebtTotal(input({
      creditCards: [card("card-1")],
      creditCardCycles: [cycle("cycle-1", "card-1")],
      creditCardStatements: [statement("statement-1", "cycle-1")],
      creditCardStrategies: [creditCardStrategy],
    }));

    expect(result).toEqual({
      totalRequiredCentavos: expectedTarget,
      obligations: [{ accountId: "card-1", kind: "credit_card_statement", scheduledDueDates: ["2026-04-15"], configuredTargetCentavos: expectedTarget, recordedAmountCentavos: 0, remainingRequiredCentavos: expectedTarget }],
    });
  });

  it("defaults an active card without a strategy to Pay in Full and subtracts recorded payments", () => {
    const result = getRequiredDebtTotal(input({
      creditCards: [card("card-1")],
      creditCardCycles: [cycle("cycle-1", "card-1")],
      creditCardStatements: [statement("statement-1", "cycle-1")],
      creditCardPayments: [payment("statement-1", "cycle-1", 4_000)],
    }));

    expect(result.totalRequiredCentavos).toBe(6_000);
    expect(result.obligations[0]).toMatchObject({ configuredTargetCentavos: 10_000, recordedAmountCentavos: 4_000, remainingRequiredCentavos: 6_000 });
  });

  it("includes an unpaid authoritative statement due before the budget period", () => {
    const result = getRequiredDebtTotal(input({
      creditCards: [card("card-1")],
      creditCardCycles: [cycle("cycle-1", "card-1")],
      creditCardStatements: [statement("statement-1", "cycle-1", "2026-03-20")],
      creditCardPayments: [payment("statement-1", "cycle-1", 4_000, "2026-03-21")],
    }));

    expect(result.obligations).toContainEqual(expect.objectContaining({
      scheduledDueDates: ["2026-03-20"], remainingRequiredCentavos: 6_000,
    }));
  });

  it("does not show a fully paid authoritative statement as a zero-value obligation", () => {
    const result = getRequiredDebtTotal(input({
      creditCards: [card("card-1")],
      creditCardCycles: [cycle("cycle-1", "card-1")],
      creditCardStatements: [statement("statement-1", "cycle-1", "2026-03-20")],
      creditCardPayments: [payment("statement-1", "cycle-1", 10_000, "2026-03-21")],
    }));

    expect(result.obligations).toEqual([]);
  });

  it("ignores statements that are deleted, non-authoritative, out of period, or not owned by an active card", () => {
    const included = statement("included", "cycle-1");
    const deleted = { ...statement("deleted", "cycle-1"), deleted: true };
    const nonAuthoritative = { ...statement("draft", "cycle-1"), authoritative: false };
    const outOfPeriod = statement("later", "cycle-1", "2026-05-01");
    const wrongUser = statement("wrong-user", "other-cycle");
    const result = getRequiredDebtTotal(input({
      creditCards: [card("card-1")],
      creditCardCycles: [cycle("cycle-1", "card-1"), cycle("other-cycle", "card-1", "user-2")],
      creditCardStatements: [included, deleted, nonAuthoritative, outOfPeriod, wrongUser],
    }));

    expect(result.obligations).toHaveLength(1);
    expect(result.obligations[0]?.scheduledDueDates).toEqual(["2026-04-15"]);
  });

  it.each([
    ["weekly", "2026-04-01", ["2026-04-01", "2026-04-08", "2026-04-15", "2026-04-22", "2026-04-29"]],
    ["biweekly", "2026-04-01", ["2026-04-01", "2026-04-15", "2026-04-29"]],
    ["semi_monthly", "2026-04-01", ["2026-04-01", "2026-04-15"]],
    ["monthly", "2026-03-31", ["2026-04-30"]],
    ["quarterly", "2026-01-30", ["2026-04-30"]],
  ] as const)("includes each %s payment scheduled in the inclusive range", (paymentFrequency, nextDueDate, dueDates) => {
    const result = getRequiredDebtTotal(input({ debts: [debt("debt-1", paymentFrequency, nextDueDate)] }));

    expect(result.obligations).toEqual([{
      accountId: "debt-1", kind: "non_credit_card", scheduledDueDates: dueDates,
      configuredTargetCentavos: dueDates.length * 1_000, recordedAmountCentavos: 0,
      remainingRequiredCentavos: dueDates.length * 1_000,
    }]);
  });

  it("caps a debt's scheduled requirement at its remaining balance", () => {
    const result = getRequiredDebtTotal(input({ debts: [debt("debt-1", "weekly", "2026-04-01", 1_500)] }));

    expect(result.totalRequiredCentavos).toBe(1_500);
    expect(result.obligations[0]?.scheduledDueDates).toEqual(["2026-04-01", "2026-04-08"]);
  });

  it("subtracts non-credit payments recorded in the budget period", () => {
    const result = getRequiredDebtTotal(input({
      debts: [debt("debt-1", "monthly", "2026-04-15")],
      debtPayments: [debtPayment("debt-1", 400)],
    }));

    expect(result.obligations).toEqual([expect.objectContaining({
      configuredTargetCentavos: 1_000, recordedAmountCentavos: 400, remainingRequiredCentavos: 600,
    })]);
  });

  it("includes a non-credit debt due within a monthly budget that crosses into the next month", () => {
    const result = getRequiredDebtTotal(input({
      periodStart: "2026-09-14",
      periodEnd: "2026-10-14",
      debts: [debt("candies", "monthly", "2026-10-12", 27_998_00, 2_500_00)],
    }));

    expect(result.obligations).toContainEqual(expect.objectContaining({
      accountId: "candies", scheduledDueDates: ["2026-10-12"], remainingRequiredCentavos: 2_500_00,
    }));
  });

  it("includes the estimated current-cycle balance when its cutoff falls in the budget period", () => {
    const result = getRequiredDebtTotal(input({
      periodStart: "2026-09-14",
      periodEnd: "2026-10-14",
      creditCards: [card("card-1")],
      creditCardCycles: [{ ...cycle("cycle-1", "card-1"), cycle_start_date: "2026-09-04", cutoff_date: "2026-09-15" }],
      creditCardCycleTransactions: [cycleTransaction("cycle-1", 2_500_00)],
    }));

    expect(result.obligations).toContainEqual(expect.objectContaining({
      accountId: "card-1", scheduledDueDates: ["2026-09-15"], remainingRequiredCentavos: 2_500_00,
    }));
  });

  it("excludes inactive, paid-off, zero-balance, and incomplete debts", () => {
    const active = debt("active", "monthly", "2026-04-01");
    const archived = { ...debt("archived", "monthly", "2026-04-01"), status: "archived" as const };
    const paidOff = { ...debt("paid", "monthly", "2026-04-01"), status: "paid_off" as const };
    const zeroBalance = debt("zero", "monthly", "2026-04-01", 0);
    const incomplete = { ...debt("incomplete", "monthly", "2026-04-01"), nextDueDate: null };
    const custom = { ...debt("custom", "custom", "2026-04-01"), paymentSchedule: { customIntervalDays: 10 } };
    const result = getRequiredDebtTotal(input({ debts: [active, archived, paidOff, zeroBalance, incomplete, custom] }));

    expect(result.obligations).toHaveLength(2);
    expect(result.obligations[0]?.accountId).toBe("active");
    expect(result.obligations[1]?.accountId).toBe("custom");
  });
});
