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

// Whether a yearly expense covers the candidate: within the window around its anniversary, or, when the user
// chose the months it comes back in, any of those months in the year after it.
function anchorCovers(anchor, months, transactionDate) {
  const days = daysBetween(anchor.transactionDate, transactionDate);
  if (!months) return Math.abs(days - 365) <= YEARLY_WINDOW_DAYS;
  return days > 0 && days <= 365 + YEARLY_WINDOW_DAYS && months.includes(Number(transactionDate.slice(5, 7)));
}

// The largest yearly expense that covers the candidate's date.
function yearlyAnchor(anchors, recurrenceMonths, transactionDate) {
  let anchor = null;
  for (const item of anchors) {
    if (anchorCovers(item, recurrenceMonths.get(item.id) ?? null, transactionDate) && (!anchor || item.amountCentavos > anchor.amountCentavos)) anchor = item;
  }
  return anchor;
}

// recurrences maps a transaction ID to the user's answer: "one_time", "frequent", or "yearly";
// recurrenceMonths maps a yearly answer to the calendar months (1-12) the user said it comes back in.
function scanSpendings(transactions, recurrences, recurrenceMonths) {
  const histories = new Map();
  const yearlyAnchors = new Map();
  // A payment covered by an anchor with chosen months takes them on, so next year still knows them.
  const anchorMonths = new Map(recurrenceMonths);
  const insights = [];
  const ordered = [...transactions].sort((first, second) => first.transactionDate.localeCompare(second.transactionDate) || first.id.localeCompare(second.id));

  for (const transaction of ordered) {
    const history = histories.get(transaction.subcategoryId) ?? [];
    const anchors = yearlyAnchors.get(transaction.subcategoryId) ?? [];
    let flagged = false;
    let withinYearlyAllowance = false;
    let coveringAnchor = null;
    if (history.length >= MINIMUM_HISTORY && spansThreeCalendarMonths(history[0].transactionDate, transaction.transactionDate)) {
      const values = history.map((item) => Math.log1p(item.amountCentavos / 100)).sort((first, second) => first - second);
      const q1 = percentile(values, 0.25);
      const q3 = percentile(values, 0.75);
      const iqr = q3 - q1;
      if (iqr > 0) {
        const lower = q1 - IQR_MULTIPLIER * iqr;
        const usualUpper = q3 + IQR_MULTIPLIER * iqr;
        const anchor = yearlyAnchor(anchors, anchorMonths, transaction.transactionDate);
        const upper = anchor ? Math.max(usualUpper, Math.log1p(anchor.amountCentavos * YEARLY_ALLOWANCE / 100)) : usualUpper;
        const value = Math.log1p(transaction.amountCentavos / 100);
        withinYearlyAllowance = value > usualUpper && value <= upper;
        if (withinYearlyAllowance) coveringAnchor = anchor;
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
            recurrenceMonths: recurrenceMonths.get(transaction.id) ?? null,
          });
        }
      }
    }
    // Flagged expenses stay out of the baseline unless the user says they will be frequent;
    // a yearly payment would otherwise widen the everyday range. A yearly expense, or one that only
    // fits because of last year's, becomes the anchor for next year instead.
    if (withinYearlyAllowance && anchorMonths.has(coveringAnchor.id)) anchorMonths.set(transaction.id, anchorMonths.get(coveringAnchor.id));
    if (recurrences.get(transaction.id) === "yearly" || withinYearlyAllowance) anchors.push(transaction);
    else if (!flagged || recurrences.get(transaction.id) === "frequent") history.push(transaction);
    histories.set(transaction.subcategoryId, history);
    yearlyAnchors.set(transaction.subcategoryId, anchors);
  }
  const recurring = [...yearlyAnchors.values()].flat().map((transaction) => ({ ...transaction, months: anchorMonths.get(transaction.id) ?? null }));
  return { insights, recurring };
}

function detectUnusualSpendings(transactions, recurrences = new Map(), recurrenceMonths = new Map()) {
  return scanSpendings(transactions, recurrences, recurrenceMonths).insights;
}

// Payments that come back in certain months: those the user answered yearly, and those last year's answer
// covers. months holds the calendar months (1-12) they recur in, or null for their own month.
function detectRecurringPayments(transactions, recurrences = new Map(), recurrenceMonths = new Map()) {
  return scanSpendings(transactions, recurrences, recurrenceMonths).recurring;
}

module.exports = { detectUnusualSpendings, detectRecurringPayments, UNUSUAL_SPENDING_MODEL_VERSION };
