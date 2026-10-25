import { dueDatesBetween, type PaymentSchedule } from "../billers/schedule";
import type { QuarterlyForecastPayload } from "./types";

export const SCHEDULED_PAYMENTS_CATEGORY = "billers_remittances";

type ScheduledAmount = PaymentSchedule & { amountCentavos: number };

type Period = { totalCentavos: number; categories: { category: string; amountCentavos: number }[] };

function bounds(year: number, firstMonth: number, monthCount: number): { start: string; end: string } {
  return {
    start: new Date(Date.UTC(year, firstMonth, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(year, firstMonth + monthCount, 0)).toISOString().slice(0, 10),
  };
}

function quarterBounds(quarter: string): { start: string; end: string } {
  return bounds(Number(quarter.slice(0, 4)), (Number(quarter.slice(5)) - 1) * 3, 3);
}

function monthBounds(month: string): { start: string; end: string } {
  return bounds(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1);
}

function withScheduled<T extends Period>(period: T, { start, end }: { start: string; end: string }, payments: ScheduledAmount[]): T {
  const amountCentavos = payments.reduce((sum, payment) => sum + dueDatesBetween(payment, start, end).length * payment.amountCentavos, 0);
  if (amountCentavos === 0) return period;
  return { ...period, totalCentavos: period.totalCentavos + amountCentavos, categories: [...period.categories, { category: SCHEDULED_PAYMENTS_CATEGORY, amountCentavos }] };
}

// Billers and remittances are fixed commitments, so each quarter and month adds every scheduled due date at
// its set amount instead of letting the HFCE trend scale them.
export function addScheduledPayments(forecast: QuarterlyForecastPayload, payments: ScheduledAmount[]): QuarterlyForecastPayload {
  return {
    ...forecast,
    quarters: forecast.quarters.map((quarter) => withScheduled(quarter, quarterBounds(quarter.quarter), payments)),
    ...(forecast.months ? { months: forecast.months.map((month) => withScheduled(month, monthBounds(month.month), payments)) } : {}),
  };
}
