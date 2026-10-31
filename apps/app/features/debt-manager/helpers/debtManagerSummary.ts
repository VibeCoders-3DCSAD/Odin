export type RecordedDebtPayment = { paymentDate: string; debtName: string; amountCentavos: number };
export type DebtRepaymentState = "ahead" | "on_track" | "behind" | "paid_off" | "not_scheduled";
export type DebtSummaryItem = { currentDebtCentavos: number; state: DebtRepaymentState };
export type DebtPaymentTrendPoint = { date: string; debtName: string; amountCentavos: number };

export type DebtManagerSummary = {
  currentDebtCentavos: number;
  totalPaidCentavos: number;
  paymentTrend: DebtPaymentTrendPoint[];
  progress: {
    activeCount: number;
    paidOffCount: number;
    aheadCount: number;
    onTrackCount: number;
    behindCount: number;
    notScheduledCount: number;
  };
};

export function buildDebtManagerSummary(items: DebtSummaryItem[], payments: RecordedDebtPayment[], asOfDate: string): DebtManagerSummary {
  const paymentTrend = payments
    .filter((payment) => payment.paymentDate <= asOfDate)
    .sort((left, right) => left.paymentDate.localeCompare(right.paymentDate))
    .map(({ paymentDate, debtName, amountCentavos }) => ({ date: paymentDate, debtName, amountCentavos }));

  const progress = { activeCount: 0, paidOffCount: 0, aheadCount: 0, onTrackCount: 0, behindCount: 0, notScheduledCount: 0 };
  for (const item of items) {
    if (item.state === "paid_off" || item.currentDebtCentavos === 0) progress.paidOffCount += 1;
    else progress.activeCount += 1;
    if (item.state === "ahead") progress.aheadCount += 1;
    if (item.state === "on_track") progress.onTrackCount += 1;
    if (item.state === "behind") progress.behindCount += 1;
    if (item.state === "not_scheduled") progress.notScheduledCount += 1;
  }

  return {
    currentDebtCentavos: items.reduce((sum, item) => sum + Math.max(0, item.currentDebtCentavos), 0),
    totalPaidCentavos: paymentTrend.reduce((sum, point) => sum + point.amountCentavos, 0),
    paymentTrend,
    progress,
  };
}
