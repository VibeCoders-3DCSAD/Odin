import { creditBalance, creditCardDebtBudgetTarget, installmentAmortization, nextCycleAfter, routePostingDate, statementPaymentStatus, validateStatementStrategy } from "../creditCardLogic";

const statement = { statementBalanceMinor: 10_000, minimumDueMinor: 1_000, authoritative: true };

describe("credit card rules", () => {
  it("routes by posting date and falls back to transaction date", () => {
    const cycles = [
      { id: "jan", cycleStartDate: "2026-01-01", cutoffDate: "2026-01-31", statementDate: "2026-02-05" },
      { id: "feb", cycleStartDate: "2026-02-01", cutoffDate: "2026-02-28", statementDate: "2026-03-05" },
    ];
    expect(routePostingDate("2026-01-31", "2026-02-01", cycles).id).toBe("feb");
    expect(routePostingDate("2026-01-31", undefined, cycles).id).toBe("jan");
  });

  it("builds the next cycle after a late posting", () => {
    expect(nextCycleAfter({ id: "jan", cycleStartDate: "2026-01-01", cutoffDate: "2026-01-31", statementDate: "2026-02-05" })).toMatchObject({ cycleStartDate: "2026-02-01", cutoffDate: "2026-03-03", statementDate: "2026-03-08" });
  });

  it("classifies statement payments and overpayments", () => {
    expect(statementPaymentStatus(statement, 0)).toBe("unpaid");
    expect(statementPaymentStatus(statement, 500)).toBe("partially_paid");
    expect(statementPaymentStatus(statement, 1_000)).toBe("minimum_satisfied");
    expect(statementPaymentStatus(statement, 10_000)).toBe("fully_paid");
    expect(statementPaymentStatus(statement, 10_001)).toBe("overpaid");
    expect(creditBalance(12_000, 10_000)).toBe(2_000);
  });

  it("validates independent repayment targets", () => {
    expect(validateStatementStrategy("pay_full", undefined, statement)).toBe(10_000);
    expect(validateStatementStrategy("pay_minimum", undefined, statement)).toBe(1_000);
    expect(() => validateStatementStrategy("custom", 500, statement)).toThrow("minimum amount due");
    expect(() => validateStatementStrategy("custom", 10_000, statement)).toThrow("less than the statement balance");
  });

  it("calculates only the installment amortization for each cycle", () => {
    expect(installmentAmortization(10_000, 4, "zero_interest")).toBe(2_500);
    expect(installmentAmortization(10_000, 4, "interest_bearing", 1200)).toBe(2_563);
  });

  it("uses the selected statement target in the budget", () => {
    expect(creditCardDebtBudgetTarget(statement, "pay_full")).toBe(10_000);
    expect(creditCardDebtBudgetTarget(statement, "pay_minimum")).toBe(1_000);
    expect(creditCardDebtBudgetTarget(statement, "custom", 2_500)).toBe(2_500);
  });
});
