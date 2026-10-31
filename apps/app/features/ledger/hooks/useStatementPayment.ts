import { useEffect, useState } from "react";
import { getCreditCardPaymentByStatement, type CreditCardPayment, type StatementPaymentContext } from "../../../local-db/repositories/creditCardPayments";
import { getCreditCardStatementByCycle, type CreditCardStatement } from "../../../local-db/repositories/creditCardStatements";

// Loads the statement a payment is for, and the payment already recorded against it. Only the user's
// current authoritative statement for that cycle is accepted.
export function useStatementPayment(userId: string, statementPaymentContext: StatementPaymentContext | undefined, onUnavailable: (message: string) => void) {
  const [statementPayment, setStatementPayment] = useState<CreditCardStatement | null>(null);
  const [existingStatementPayment, setExistingStatementPayment] = useState<CreditCardPayment | null>(null);

  useEffect(() => {
    if (!statementPaymentContext) return;
    let active = true;
    getCreditCardStatementByCycle(userId, statementPaymentContext.cycleId)
      .then((statement) => {
        if (!active) return;
        if (!statement || statement.id !== statementPaymentContext.statementId || !statement.authoritative) {
          onUnavailable("The selected credit-card statement is no longer available.");
          return;
        }
        setStatementPayment(statement);
        return getCreditCardPaymentByStatement(userId, statement.id).then((payment) => { if (active) setExistingStatementPayment(payment); });
      })
      .catch(() => { if (active) onUnavailable("The selected credit-card statement is no longer available."); });
    return () => { active = false; };
  }, [statementPaymentContext, userId, onUnavailable]);

  return { isStatementPayment: Boolean(statementPaymentContext), statementPayment, existingStatementPayment };
}
