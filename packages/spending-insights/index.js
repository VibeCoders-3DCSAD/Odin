const MINIMUM_HISTORY = 6;
const IQR_MULTIPLIER = 1.5;
const UNUSUAL_SPENDING_MODEL_VERSION = "personal-transaction-iqr-local-v2.4.0";

function percentile(sorted, proportion) {
  const position = (sorted.length - 1) * proportion;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function spansThreeCalendarMonths(firstDate, candidateDate) {
  const first = new Date(`${firstDate}T00:00:00.000Z`);
  const candidate = new Date(`${candidateDate}T00:00:00.000Z`);
  return (candidate.getUTCFullYear() - first.getUTCFullYear()) * 12 + candidate.getUTCMonth() - first.getUTCMonth() >= 3;
}

function detectUnusualSpendings(transactions, confirmedRecurringIds = new Set()) {
  const histories = new Map();
  const insights = [];
  const ordered = [...transactions].sort((first, second) => first.transactionDate.localeCompare(second.transactionDate) || first.id.localeCompare(second.id));

  for (const transaction of ordered) {
    const history = histories.get(transaction.subcategoryId) ?? [];
    let flagged = false;
    if (history.length >= MINIMUM_HISTORY && spansThreeCalendarMonths(history[0].transactionDate, transaction.transactionDate)) {
      const values = history.map((item) => Math.log1p(item.amountCentavos / 100)).sort((first, second) => first - second);
      const q1 = percentile(values, 0.25);
      const q3 = percentile(values, 0.75);
      const iqr = q3 - q1;
      if (iqr > 0) {
        const lower = q1 - IQR_MULTIPLIER * iqr;
        const upper = q3 + IQR_MULTIPLIER * iqr;
        const value = Math.log1p(transaction.amountCentavos / 100);
        if (value < lower || value > upper) {
          flagged = true;
          const usualSpending = percentile(history.map((item) => item.amountCentavos).sort((first, second) => first - second), 0.5);
          insights.push({
            transactionId: transaction.id,
            amountCentavos: transaction.amountCentavos,
            subcategoryLabel: transaction.subcategoryLabel,
            accountName: transaction.accountName,
            transactionDate: transaction.transactionDate,
            usualSpendingCentavos: Math.round(usualSpending),
            lowerBoundCentavos: Math.max(0, Math.round(Math.expm1(lower) * 100)),
            upperBoundCentavos: Math.max(0, Math.round(Math.expm1(upper) * 100)),
            severity: Math.max(lower - value, value - upper) / iqr,
            usableHistoryCount: history.length,
            subcategoryId: transaction.subcategoryId,
            confirmedRecurring: confirmedRecurringIds.has(transaction.id),
          });
        }
      }
    }
    // Flagged expenses stay out of the baseline until the user confirms them as recurring.
    if (!flagged || confirmedRecurringIds.has(transaction.id)) history.push(transaction);
    histories.set(transaction.subcategoryId, history);
  }
  return insights;
}

module.exports = { detectUnusualSpendings, UNUSUAL_SPENDING_MODEL_VERSION };
