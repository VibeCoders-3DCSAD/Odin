import { parseTransactionFormParams, transactionFormHref, type TransactionFormTarget } from "../transactionFormRoute";

const id = "0f8b2c1e-1d2a-4b3c-8d4e-5f6a7b8c9d0e";

function paramsOf(target: TransactionFormTarget) {
  const href = transactionFormHref(target) as { pathname: string; params: Record<string, string> };
  expect(href.pathname).toBe("/activity/new");
  return href.params;
}

describe("transaction form route", () => {
  it("round-trips every target through primitive params", () => {
    const targets: TransactionFormTarget[] = [
      { kind: "new" },
      { kind: "edit", transactionId: id },
      { kind: "pay-statement", statementId: "statement-1", cycleId: "cycle-1" },
      { kind: "edit-statement-payment", transactionId: id, statementId: "statement-1", cycleId: "cycle-1" },
      { kind: "record-debt-payment", debtAccountId: "debt-1" },
      { kind: "edit-debt-payment", transactionId: id, debtPaymentId: "payment-1", debtAccountId: "debt-1" },
      { kind: "savings-activity", savingsGoalId: "goal-1", activity: "contribution" },
      { kind: "savings-activity", savingsGoalId: "goal-1", activity: "withdrawal", amountCentavos: 125000 },
    ];
    for (const target of targets) {
      const params = paramsOf(target);
      for (const value of Object.values(params)) expect(typeof value).toBe("string");
      expect(parseTransactionFormParams(params)).toEqual(target);
    }
  });

  it("defaults to a new transaction", () => {
    expect(paramsOf({ kind: "new" })).toEqual({});
    expect(transactionFormHref()).toEqual(transactionFormHref({ kind: "new" }));
  });

  it("ignores unknown params and empty values", () => {
    expect(parseTransactionFormParams({ transactionId: id, foo: "bar", cycleId: "" })).toEqual({ kind: "edit", transactionId: id });
  });

  it("rejects malformed ids, repeated params and unsafe amounts", () => {
    expect(parseTransactionFormParams({ transactionId: "1 OR 1=1" })).toBeNull();
    expect(parseTransactionFormParams({ transactionId: "../etc" })).toBeNull();
    expect(parseTransactionFormParams({ transactionId: "x".repeat(200) })).toBeNull();
    expect(parseTransactionFormParams({ transactionId: [id, id] })).toBeNull();
    for (const amountCentavos of ["0", "-5", "1.5", "1e3", "9999999999999999"]) {
      expect(parseTransactionFormParams({ savingsGoalId: "goal-1", kind: "contribution", amountCentavos })).toBeNull();
    }
  });

  it("whitelists the savings activity kind", () => {
    expect(parseTransactionFormParams({ savingsGoalId: "goal-1", kind: "transfer" })).toBeNull();
    expect(parseTransactionFormParams({ savingsGoalId: "goal-1" })).toBeNull();
  });

  it("rejects combinations that match no form", () => {
    expect(parseTransactionFormParams({ statementId: "statement-1" })).toBeNull();
    expect(parseTransactionFormParams({ debtPaymentId: "payment-1", debtAccountId: "debt-1" })).toBeNull();
    expect(parseTransactionFormParams({ transactionId: id, debtAccountId: "debt-1" })).toBeNull();
    expect(parseTransactionFormParams({ statementId: "s", cycleId: "c", savingsGoalId: "g", kind: "contribution" })).toBeNull();
  });
});
