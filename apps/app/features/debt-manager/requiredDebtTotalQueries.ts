import { listCreditCardCycles, listCreditCardCycleTransactions } from "../../local-db/repositories/creditCardCycles";
import { listCreditCardPayments } from "../../local-db/repositories/creditCardPayments";
import { listCreditCardStrategies } from "../../local-db/repositories/creditCardRepaymentPlans";
import { listCreditCardStatements } from "../../local-db/repositories/creditCardStatements";
import { listDebtAccounts } from "../../local-db/repositories/debtAccounts";
import { listAllDebtPayments } from "../../local-db/repositories/debtPayments";
import { listFinancialAccounts } from "../../local-db/repositories/financialFoundations";
import { getRequiredDebtTotal, type RequiredDebtTotal } from "./requiredDebtTotal";

export type RequiredDebtTotalForPeriod = RequiredDebtTotal & {
  accountNames: Record<string, string>;
};

export async function getRequiredDebtTotalForPeriod(
  userId: string,
  periodStart: string,
  periodEnd: string,
): Promise<RequiredDebtTotalForPeriod> {
  const [debts, creditCards, creditCardCycles, creditCardCycleTransactions, creditCardStatements, creditCardStrategies, creditCardPayments, debtPayments] = await Promise.all([
    listDebtAccounts(userId, "all"),
    listFinancialAccounts(userId),
    listCreditCardCycles(userId),
    listCreditCardCycleTransactions(userId),
    listCreditCardStatements(userId),
    listCreditCardStrategies(userId),
    listCreditCardPayments(userId),
    listAllDebtPayments(userId),
  ]);

  const total = getRequiredDebtTotal({
    periodStart,
    periodEnd,
    debts,
    creditCards,
    creditCardCycles,
    creditCardCycleTransactions,
    creditCardStatements,
    creditCardStrategies,
    creditCardPayments,
    debtPayments,
  });
  return {
    ...total,
    accountNames: Object.fromEntries([
      ...debts.map((debt) => [debt.id, debt.name]),
      ...creditCards.map((card) => [card.id, card.name]),
    ]),
  };
}
