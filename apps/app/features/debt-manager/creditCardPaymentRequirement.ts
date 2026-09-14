import type { FinancialAccount } from "../../local-db/repositories/financialFoundations";
import type { CreditCardCycle } from "../../local-db/repositories/creditCardCycles";
import type { CreditCardPayment } from "../../local-db/repositories/creditCardPayments";
import type { CreditCardStrategy } from "../../local-db/repositories/creditCardRepaymentPlans";
import { statementPaymentTargetCentavos } from "../../local-db/repositories/creditCardRepaymentPlans";
import type { CreditCardStatement } from "../../local-db/repositories/creditCardStatements";

export function getCreditCardPaymentRequirementCentavos({
  cards,
  cycles,
  statements,
  payments,
  strategies,
  asOfDate,
}: {
  cards: FinancialAccount[];
  cycles: CreditCardCycle[];
  statements: CreditCardStatement[];
  payments: CreditCardPayment[];
  strategies: CreditCardStrategy[];
  asOfDate: string;
}) {
  return cards.reduce((total, card) => {
    const cycleIds = new Set(cycles.filter((cycle) => cycle.account_id === card.id).map((cycle) => cycle.id));
    const statement = statements
      .filter((item) => item.authoritative && !item.deleted && cycleIds.has(item.cycle_id) && item.statement_date <= asOfDate)
      .sort((left, right) => right.statement_date.localeCompare(left.statement_date))[0];
    if (!statement) return total;
    const strategy = strategies.find((item) => item.accountId === card.id);
    const target = strategy
      ? statementPaymentTargetCentavos(statement, strategy) ?? statement.statement_balance_centavos
      : statement.statement_balance_centavos;
    const paid = payments
      .filter((payment) => payment.statement_id === statement.id && payment.payment_date <= asOfDate)
      .reduce((sum, payment) => sum + payment.amount_centavos, 0);
    return total + Math.max(0, Math.min(statement.statement_balance_centavos, target) - paid);
  }, 0);
}
