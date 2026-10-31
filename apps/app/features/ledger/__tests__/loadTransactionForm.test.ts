jest.mock("../../../local-db/repositories/ledger/ledger", () => ({ getTransaction: jest.fn() }));
jest.mock("../../../local-db/repositories/credit-cards/creditCardPayments", () => ({ getCreditCardPaymentByStatement: jest.fn() }));
jest.mock("../../../local-db/repositories/debts/debtAccounts", () => ({ getDebtAccount: jest.fn() }));
jest.mock("../../../local-db/repositories/debts/debtPayments", () => ({ listDebtPayments: jest.fn() }));
jest.mock("../../../local-db/repositories/savings/savingsGoals", () => ({ getSavingsGoal: jest.fn() }));

import { getCreditCardPaymentByStatement } from "../../../local-db/repositories/credit-cards/creditCardPayments";
import { getDebtAccount } from "../../../local-db/repositories/debts/debtAccounts";
import { listDebtPayments } from "../../../local-db/repositories/debts/debtPayments";
import { getTransaction } from "../../../local-db/repositories/ledger/ledger";
import { getSavingsGoal } from "../../../local-db/repositories/savings/savingsGoals";
import { loadTransactionForm } from "../services/loadTransactionForm";

const transaction = { id: "tx-1" } as never;

beforeEach(() => jest.resetAllMocks());

describe("loadTransactionForm", () => {
  it("loads an edit only through the user-scoped lookup", async () => {
    jest.mocked(getTransaction).mockResolvedValue(transaction);
    await expect(loadTransactionForm("user-1", { kind: "edit", transactionId: "tx-1" })).resolves.toEqual({ transaction });
    expect(getTransaction).toHaveBeenCalledWith("user-1", "tx-1");

    jest.mocked(getTransaction).mockResolvedValue(null);
    await expect(loadTransactionForm("user-1", { kind: "edit", transactionId: "someone-else" })).resolves.toBeNull();
  });

  it("requires a statement payment edit to belong to that statement", async () => {
    jest.mocked(getTransaction).mockResolvedValue(transaction);
    jest.mocked(getCreditCardPaymentByStatement).mockResolvedValue({ transaction_id: "tx-1", cycle_id: "cycle-1" } as never);
    const target = { kind: "edit-statement-payment", transactionId: "tx-1", statementId: "st-1", cycleId: "cycle-1" } as const;
    await expect(loadTransactionForm("user-1", target)).resolves.toEqual({ transaction, statementPaymentContext: { statementId: "st-1", cycleId: "cycle-1" } });

    jest.mocked(getCreditCardPaymentByStatement).mockResolvedValue({ transaction_id: "tx-2", cycle_id: "cycle-1" } as never);
    await expect(loadTransactionForm("user-1", target)).resolves.toBeNull();
  });

  it("checks debts, debt payments and savings goals against the user", async () => {
    jest.mocked(getDebtAccount).mockResolvedValue(null);
    await expect(loadTransactionForm("user-1", { kind: "record-debt-payment", debtAccountId: "debt-1" })).resolves.toBeNull();
    jest.mocked(getDebtAccount).mockResolvedValue({ id: "debt-1" } as never);
    await expect(loadTransactionForm("user-1", { kind: "record-debt-payment", debtAccountId: "debt-1" })).resolves.toEqual({ debtPaymentDebtId: "debt-1" });
    expect(getDebtAccount).toHaveBeenCalledWith("user-1", "debt-1");

    jest.mocked(getTransaction).mockResolvedValue(transaction);
    jest.mocked(listDebtPayments).mockResolvedValue([{ id: "pay-1", debt_account_id: "debt-1", transaction_id: "tx-1" }] as never);
    await expect(loadTransactionForm("user-1", { kind: "edit-debt-payment", transactionId: "tx-1", debtPaymentId: "pay-1", debtAccountId: "debt-1" }))
      .resolves.toEqual({ transaction, debtPaymentContext: { paymentId: "pay-1", debtAccountId: "debt-1" } });
    expect(listDebtPayments).toHaveBeenCalledWith("user-1", "debt-1");
    await expect(loadTransactionForm("user-1", { kind: "edit-debt-payment", transactionId: "tx-1", debtPaymentId: "other", debtAccountId: "debt-1" })).resolves.toBeNull();

    jest.mocked(getSavingsGoal).mockResolvedValue(null);
    await expect(loadTransactionForm("user-1", { kind: "savings-activity", savingsGoalId: "goal-1", activity: "withdrawal" })).resolves.toBeNull();
    jest.mocked(getSavingsGoal).mockResolvedValue({ id: "goal-1" } as never);
    await expect(loadTransactionForm("user-1", { kind: "savings-activity", savingsGoalId: "goal-1", activity: "withdrawal", amountCentavos: 500 }))
      .resolves.toEqual({ savingsActivityContext: { savingsGoalId: "goal-1", kind: "withdrawal", amountCentavos: 500 } });
  });
});
