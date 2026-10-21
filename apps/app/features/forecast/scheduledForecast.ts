import { dueDatesBetween, type PaymentSchedule } from "../billers/schedule";
import type { QuarterlyForecastPayload } from "./types";

export const SCHEDULED_PAYMENTS_CATEGORY = "billers_remittances";

type ScheduledAmount = PaymentSchedule & { amountCentavos: number };

function quarterBounds(quarter: string): { start: string; end: string } {
  const year = Number(quarter.slice(0, 4));
  const firstMonth = (Number(quarter.slice(5)) - 1) * 3;
  return {
    start: new Date(Date.UTC(year, firstMonth, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(year, firstMonth + 3, 0)).toISOString().slice(0, 10),
  };
}

// Billers and remittances are fixed commitments, so each quarter adds every scheduled due date at its set
// amount instead of letting the HFCE trend scale them.
export function addScheduledPayments(forecast: QuarterlyForecastPayload, payments: ScheduledAmount[]): QuarterlyForecastPayload {
  return {
    ...forecast,
    quarters: forecast.quarters.map((quarter) => {
      const { start, end } = quarterBounds(quarter.quarter);
      const amountCentavos = payments.reduce((sum, payment) => sum + dueDatesBetween(payment, start, end).length * payment.amountCentavos, 0);
      if (amountCentavos === 0) return quarter;
      return { ...quarter, totalCentavos: quarter.totalCentavos + amountCentavos, categories: [...quarter.categories, { category: SCHEDULED_PAYMENTS_CATEGORY, amountCentavos }] };
    }),
  };
}
