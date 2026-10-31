import { useEffect, useState } from "react";
import { listDebtAccounts, type DebtAccount } from "../../../local-db/repositories/debtAccounts";
import type { DebtPaymentContext } from "../../../local-db/repositories/debtPayments";

type Options = {
  userId: string;
  debtPaymentDebtId?: string;
  debtPaymentContext?: DebtPaymentContext;
  setDescription: (description: string) => void;
};

// The "payment for my debt" split. Opening the form for a debt, or to edit one of its payments, locks the debt.
export function useDebtPaymentFields({ userId, debtPaymentDebtId, debtPaymentContext, setDescription }: Options) {
  const [isDebtPayment, setIsDebtPayment] = useState(Boolean(debtPaymentDebtId || debtPaymentContext));
  const [debtPaymentId, setDebtPaymentId] = useState(debtPaymentDebtId ?? debtPaymentContext?.debtAccountId ?? "");
  const [debtPrincipal, setDebtPrincipal] = useState("");
  const [debtInterestOrFees, setDebtInterestOrFees] = useState("0");
  const [activeDebts, setActiveDebts] = useState<DebtAccount[]>([]);

  useEffect(() => { listDebtAccounts(userId).then(setActiveDebts).catch(() => setActiveDebts([])); }, [userId]);

  useEffect(() => {
    if (!debtPaymentDebtId) return;
    setIsDebtPayment(true);
    setDebtPaymentId(debtPaymentDebtId);
    const debt = activeDebts.find((item) => item.id === debtPaymentDebtId);
    if (debt) setDescription(`Payment to ${debt.name}`);
  }, [activeDebts, debtPaymentDebtId, setDescription]);

  useEffect(() => {
    if (!debtPaymentContext) return;
    import("../../../local-db/repositories/debtPayments").then(({ listAllDebtPayments }) => listAllDebtPayments(userId)).then((payments) => {
      const payment = payments.find((item) => item.id === debtPaymentContext.paymentId);
      if (payment) { setDebtPrincipal(String(payment.principal_centavos / 100)); setDebtInterestOrFees(String(payment.interest_centavos / 100)); }
    }).catch(() => {});
  }, [debtPaymentContext, userId]);

  function toggleDebtPayment() {
    setIsDebtPayment((current) => !current);
    setDebtPaymentId("");
    setDebtPrincipal("");
    setDebtInterestOrFees("0");
  }

  return {
    isDebtPayment, setIsDebtPayment, debtPaymentId, setDebtPaymentId,
    debtPrincipal, setDebtPrincipal, debtInterestOrFees, setDebtInterestOrFees,
    activeDebts, debtLocked: Boolean(debtPaymentDebtId || debtPaymentContext), toggleDebtPayment,
  };
}

export type DebtPaymentFields = ReturnType<typeof useDebtPaymentFields>;
