import type { DebtAccount, DebtRepaymentForecast, PaymentFrequency } from "../../local-db/repositories/debtAccounts";

const PAYMENT_INTERVAL_DAYS: Partial<Record<PaymentFrequency, number>> = {
  weekly: 7,
  biweekly: 14,
  semi_monthly: 15,
  monthly: 30,
  quarterly: 91,
};

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function getDebtRepaymentForecast(debt: Pick<DebtAccount, "currentBalanceCentavos" | "minimumPaymentCentavos" | "nextDueDate" | "paymentFrequency" | "targetPayoffDate" | "status">): DebtRepaymentForecast {
  const intervalDays = PAYMENT_INTERVAL_DAYS[debt.paymentFrequency];
  if (!debt.targetPayoffDate || !debt.nextDueDate || !intervalDays || debt.minimumPaymentCentavos <= 0) {
    return { status: "not_in_schedule", estimatedPayoffDate: null };
  }

  const paymentsRemaining = Math.ceil(debt.currentBalanceCentavos / debt.minimumPaymentCentavos);
  const estimatedPayoffDate = addDays(debt.nextDueDate, Math.max(0, paymentsRemaining - 1) * intervalDays);
  const timeToTargetDays = Math.floor((Date.parse(`${debt.targetPayoffDate}T00:00:00Z`) - Date.parse(`${debt.nextDueDate}T00:00:00Z`)) / 86_400_000);
  const paymentsToTarget = timeToTargetDays < 0 ? 0 : Math.floor(timeToTargetDays / intervalDays) + 1;
  const requiredPaymentCentavos = paymentsToTarget > 0 ? Math.ceil(debt.currentBalanceCentavos / paymentsToTarget) : Number.POSITIVE_INFINITY;
  const status = debt.minimumPaymentCentavos > requiredPaymentCentavos ? "advanced" : debt.minimumPaymentCentavos === requiredPaymentCentavos ? "on_track" : "underpaid";

  return { status, estimatedPayoffDate };
}
