import type { DebtAccount, DebtRepaymentForecast, PaymentFrequency } from "../../local-db/repositories/debtAccounts";

export const PAYMENT_INTERVAL_DAYS: Partial<Record<PaymentFrequency, number>> = {
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

export type ScheduledDebtPayment = { paymentDate: string; amountCentavos: number };

export function getDebtPaymentProgress(
  debt: Pick<DebtAccount, "currentBalanceCentavos" | "minimumPaymentCentavos" | "nextDueDate" | "paymentFrequency" | "status">,
  payments: ScheduledDebtPayment[],
  asOf = new Date().toISOString().slice(0, 10),
): DebtAccount["progress"] {
  if (debt.status === "paid_off" || debt.currentBalanceCentavos === 0) return "finished";
  const interval = PAYMENT_INTERVAL_DAYS[debt.paymentFrequency];
  if (!debt.nextDueDate || !interval || debt.minimumPaymentCentavos <= 0) return "no_payments";
  let dueCount = 0;
  for (let date = debt.nextDueDate; date <= asOf; date = addDays(date, interval)) dueCount += 1;
  if (dueCount === 0) return payments.length > 0 ? "ahead" : "on_schedule";
  const paid = payments.filter((payment) => payment.paymentDate <= asOf).reduce((sum, payment) => sum + payment.amountCentavos, 0);
  const expected = dueCount * debt.minimumPaymentCentavos;
  return paid > expected ? "ahead" : paid >= expected ? "on_schedule" : "behind";
}
