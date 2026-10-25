const MINIMUM_HISTORY = 6;
const IQR_MULTIPLIER = 1.5;
// A yearly expense raises the upper bound to 1.5x its amount within 30 days of its anniversary.
const YEARLY_ALLOWANCE = 1.5;
const YEARLY_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;
const UNUSUAL_SPENDING_MODEL_VERSION = "personal-transaction-iqr-local-v2.5.0";

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

function daysBetween(firstDate, secondDate) {
  return (Date.parse(`${secondDate}T00:00:00.000Z`) - Date.parse(`${firstDate}T00:00:00.000Z`)) / DAY_MS;
}

// The largest yearly expense whose anniversary falls within the window around the candidate's date.
function yearlyAnchor(anchors, transactionDate) {
  let anchor = null;
  for (const item of anchors) {
    const days = daysBetween(item.transactionDate, transactionDate);
    if (Math.abs(days - 365) <= YEARLY_WINDOW_DAYS && (!anchor || item.amountCentavos > anchor.amountCentavos)) anchor = item;
  }
  return anchor;
}

// recurrences maps a transaction ID to the user's answer: "one_time", "frequent", or "yearly".
function detectUnusualSpendings(transactions, recurrences = new Map()) {
  const histories = new Map();
  const yearlyAnchors = new Map();
  const insights = [];
  const ordered = [...transactions].sort((first, second) => first.transactionDate.localeCompare(second.transactionDate) || first.id.localeCompare(second.id));

  for (const transaction of ordered) {
    const history = histories.get(transaction.subcategoryId) ?? [];
    const anchors = yearlyAnchors.get(transaction.subcategoryId) ?? [];
    let flagged = false;
    let withinYearlyAllowance = false;
    if (history.length >= MINIMUM_HISTORY && spansThreeCalendarMonths(history[0].transactionDate, transaction.transactionDate)) {
      const values = history.map((item) => Math.log1p(item.amountCentavos / 100)).sort((first, second) => first - second);
      const q1 = percentile(values, 0.25);
      const q3 = percentile(values, 0.75);
      const iqr = q3 - q1;
      if (iqr > 0) {
        const lower = q1 - IQR_MULTIPLIER * iqr;
        const usualUpper = q3 + IQR_MULTIPLIER * iqr;
        const anchor = yearlyAnchor(anchors, transaction.transactionDate);
        const upper = anchor ? Math.max(usualUpper, Math.log1p(anchor.amountCentavos * YEARLY_ALLOWANCE / 100)) : usualUpper;
        const value = Math.log1p(transaction.amountCentavos / 100);
        withinYearlyAllowance = value > usualUpper && value <= upper;
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
            confirmedRecurring: recurrences.get(transaction.id) === "frequent",
            recurrence: recurrences.get(transaction.id) ?? null,
          });
        }
      }
    }
    // Flagged expenses stay out of the baseline unless the user says they will be frequent;
    // a yearly payment would otherwise widen the everyday range. A yearly expense, or one that only
    // fits because of last year's, becomes the anchor for next year instead.
    if (recurrences.get(transaction.id) === "yearly" || withinYearlyAllowance) anchors.push(transaction);
    else if (!flagged || recurrences.get(transaction.id) === "frequent") history.push(transaction);
    histories.set(transaction.subcategoryId, history);
    yearlyAnchors.set(transaction.subcategoryId, anchors);
  }
  return insights;
}

module.exports = { detectUnusualSpendings, UNUSUAL_SPENDING_MODEL_VERSION };
