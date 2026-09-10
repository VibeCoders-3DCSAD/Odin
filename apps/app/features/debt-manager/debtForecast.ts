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

function addMonths(date: string, months: number) {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  return value.toISOString().slice(0, 10);
}

function addPaymentPeriod(date: string, frequency: PaymentFrequency) {
  if (frequency === "monthly") return addMonths(date, 1);
  if (frequency === "quarterly") return addMonths(date, 3);
  const days = PAYMENT_INTERVAL_DAYS[frequency];
  return days ? addDays(date, days) : null;
}

function forecastInterestCentavos(
  debt: Pick<DebtAccount, "originalBalanceCentavos" | "annualInterestRateBps" | "interestMethod" | "interestPeriod" | "typeSpecific">,
  balanceCentavos: number,
) {
  if (debt.interestMethod === "no_interest" || debt.interestMethod === "provider_calculated" || debt.annualInterestRateBps <= 0) return 0;
  const rate = debt.annualInterestRateBps / 10_000;
  const principal = debt.interestMethod === "flat_add_on" ? debt.originalBalanceCentavos : balanceCentavos;
  return debt.interestPeriod === "none" ? 0 : Math.ceil(principal * rate);
}

function addInterestPeriod(date: string, debt: Pick<DebtAccount, "interestPeriod" | "typeSpecific">) {
  if (debt.interestPeriod === "annual") return addMonths(date, 12);
  if (debt.interestPeriod === "monthly") return addMonths(date, 1);
  if (debt.interestPeriod === "per_term" && debt.typeSpecific.termMonths) return addMonths(date, debt.typeSpecific.termMonths);
  return null;
}

function scheduleCanReachZero(
  debt: Pick<DebtAccount, "originalBalanceCentavos" | "currentBalanceCentavos" | "annualInterestRateBps" | "interestMethod" | "interestPeriod">,
  paymentFrequency: PaymentFrequency,
  contributionCentavos: number,
) {
  if (debt.interestMethod === "no_interest" || debt.interestMethod === "provider_calculated" || debt.interestPeriod === "none" || debt.interestPeriod === "per_term") return true;
  const paymentsPerYear: Partial<Record<PaymentFrequency, number>> = { weekly: 52, biweekly: 26, semi_monthly: 24, monthly: 12, quarterly: 4 };
  const interestEventsPerYear = debt.interestPeriod === "monthly" ? 12 : 1;
  const interestPrincipal = debt.interestMethod === "flat_add_on" ? debt.originalBalanceCentavos : debt.currentBalanceCentavos;
  const annualContributions = contributionCentavos * (paymentsPerYear[paymentFrequency] ?? 0);
  const annualInterest = Math.ceil(interestPrincipal * debt.annualInterestRateBps / 10_000) * interestEventsPerYear;
  return annualContributions > annualInterest;
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

export type DebtBalanceForecastPoint = { date: string; balanceCentavos: number };
export type DebtForecastStatus = "paid_off" | "ahead" | "on_track" | "behind" | "not_scheduled";
export type DebtForecast = {
  points: DebtBalanceForecastPoint[];
  projectedContributionCentavos: number;
  projectedPayoffDate: string | null;
  status: DebtForecastStatus;
};

type ForecastDebt = Pick<DebtAccount, "originalBalanceCentavos" | "currentBalanceCentavos" | "minimumPaymentCentavos" | "nextDueDate" | "paymentFrequency" | "targetPayoffDate" | "status" | "annualInterestRateBps" | "interestMethod" | "interestPeriod" | "typeSpecific">;

export function getProjectedContributionCentavos(debt: Pick<DebtAccount, "minimumPaymentCentavos">, recordedPayments: ScheduledDebtPayment[]) {
  return Math.max(debt.minimumPaymentCentavos, ...recordedPayments.map((payment) => payment.amountCentavos));
}

export function getProjectedContributionForDate(debt: Pick<DebtAccount, "minimumPaymentCentavos" | "nextDueDate" | "paymentFrequency">, date: string, asOf: string, recordedPayments: ScheduledDebtPayment[]) {
  if (!debt.nextDueDate || !PAYMENT_INTERVAL_DAYS[debt.paymentFrequency] || date < asOf) return null;
  let paymentDate = debt.nextDueDate;
  while (paymentDate < asOf) paymentDate = addPaymentPeriod(paymentDate, debt.paymentFrequency) ?? "";
  while (paymentDate && paymentDate < date) paymentDate = addPaymentPeriod(paymentDate, debt.paymentFrequency) ?? "";
  return paymentDate === date ? getProjectedContributionCentavos(debt, recordedPayments) : null;
}

export function buildDebtBalanceForecast(
  debt: ForecastDebt,
  asOf = new Date().toISOString().slice(0, 10),
  recordedPayments: ScheduledDebtPayment[] = [],
): DebtBalanceForecastPoint[] {
  const intervalDays = PAYMENT_INTERVAL_DAYS[debt.paymentFrequency];
  const historicalPayments = recordedPayments.filter((payment) => payment.paymentDate <= asOf).sort((left, right) => left.paymentDate.localeCompare(right.paymentDate));
  let historicalBalanceCentavos = debt.currentBalanceCentavos + historicalPayments.reduce((sum, payment) => sum + payment.amountCentavos, 0);
  let paymentDate = debt.nextDueDate ?? "";
  const historicalEvents: Array<{ date: string; paymentCentavos: number }> = historicalPayments.filter((payment) => payment.paymentDate < asOf).map((payment) => ({ date: payment.paymentDate, paymentCentavos: payment.amountCentavos }));
  while (paymentDate && paymentDate < asOf) {
    if (!historicalPayments.some((payment) => payment.paymentDate === paymentDate)) historicalEvents.push({ date: paymentDate, paymentCentavos: 0 });
    paymentDate = addPaymentPeriod(paymentDate, debt.paymentFrequency) ?? "";
  }
  historicalEvents.sort((left, right) => left.date.localeCompare(right.date));
  const points = historicalEvents.map((event) => {
    historicalBalanceCentavos = Math.max(0, historicalBalanceCentavos - event.paymentCentavos);
    return { date: event.date, balanceCentavos: historicalBalanceCentavos };
  });
  points.push({ date: asOf, balanceCentavos: Math.max(0, debt.currentBalanceCentavos) });
  if (debt.status === "paid_off" || debt.currentBalanceCentavos === 0 || !paymentDate || !intervalDays || debt.minimumPaymentCentavos <= 0) return points;

  const projectedPaymentCentavos = getProjectedContributionCentavos(debt, recordedPayments);
  let interestDate = debt.typeSpecific.startDate ?? "";
  while (interestDate && interestDate <= asOf) interestDate = addInterestPeriod(interestDate, debt) ?? "";
  const canReachZero = scheduleCanReachZero(debt, debt.paymentFrequency, projectedPaymentCentavos);
  if (!canReachZero && !debt.targetPayoffDate) return points;
  let balanceCentavos = debt.currentBalanceCentavos;
  while (balanceCentavos > 0) {
    const nextEventDate = interestDate && interestDate < paymentDate ? interestDate : paymentDate;
    if (!canReachZero && debt.targetPayoffDate && nextEventDate > debt.targetPayoffDate) return points;
    if (interestDate && interestDate < paymentDate) {
      balanceCentavos += forecastInterestCentavos(debt, balanceCentavos);
      points.push({ date: interestDate, balanceCentavos });
      interestDate = addInterestPeriod(interestDate, debt) ?? "";
      continue;
    }
    const nextBalanceCentavos = Math.max(0, balanceCentavos + (interestDate === paymentDate ? forecastInterestCentavos(debt, balanceCentavos) : 0) - projectedPaymentCentavos);
    points.push({ date: paymentDate, balanceCentavos: nextBalanceCentavos });
    balanceCentavos = nextBalanceCentavos;
    if (interestDate === paymentDate) interestDate = addInterestPeriod(interestDate, debt) ?? "";
    paymentDate = addPaymentPeriod(paymentDate, debt.paymentFrequency) ?? paymentDate;
  }
  return points;
}

export function buildDebtForecast(debt: ForecastDebt, asOf = new Date().toISOString().slice(0, 10), recordedPayments: ScheduledDebtPayment[] = []): DebtForecast {
  const points = buildDebtBalanceForecast(debt, asOf, recordedPayments);
  const projectedPayoffDate = points.at(-1)?.balanceCentavos === 0 ? points.at(-1)?.date ?? null : null;
  const scheduled = Boolean(debt.nextDueDate && PAYMENT_INTERVAL_DAYS[debt.paymentFrequency] && debt.minimumPaymentCentavos > 0);
  const status: DebtForecastStatus = debt.status === "paid_off" || debt.currentBalanceCentavos === 0
    ? "paid_off"
    : !scheduled
      ? "not_scheduled"
      : !projectedPayoffDate || !debt.targetPayoffDate || projectedPayoffDate > debt.targetPayoffDate
        ? "behind"
        : projectedPayoffDate < debt.targetPayoffDate
          ? "ahead"
          : "on_track";
  return { points, projectedContributionCentavos: getProjectedContributionCentavos(debt, recordedPayments), projectedPayoffDate, status };
}

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
