// Unusual payments the user said come back in certain months, such as tuition in June and November.
// Each payment recurs in its chosen calendar months for the twelve months after it was made; a payment
// without chosen months recurs in its own month, as yearly answers did before months could be chosen.
const MONTHS_PER_YEAR = 12;

function monthIndex(month) {
  return Number(month.slice(0, 4)) * MONTHS_PER_YEAR + Number(month.slice(5, 7)) - 1;
}

// A valid month list: whole numbers from 1 to 12, without repeats, in calendar order. Null when invalid.
function normalizeRecurrenceMonths(months) {
  if (!Array.isArray(months) || months.length === 0 || months.length > MONTHS_PER_YEAR) return null;
  if (!months.every((month) => Number.isInteger(month) && month >= 1 && month <= MONTHS_PER_YEAR)) return null;
  const unique = [...new Set(months)].sort((left, right) => left - right);
  return unique.length === months.length ? unique : null;
}

function paymentMonths(payment) {
  return payment.months ?? [Number(payment.transactionDate.slice(5, 7))];
}

// The latest payment for each key (a subcategory) claims each of its months, so this year's tuition replaces
// last year's instead of adding to it. Older payments keep only the months nothing newer claimed.
function resolveRecurringPayments(payments) {
  const claimed = new Map();
  const newestFirst = [...payments].sort((left, right) => right.transactionDate.localeCompare(left.transactionDate));
  return newestFirst.flatMap((payment) => {
    const taken = claimed.get(payment.key) ?? new Set();
    const months = paymentMonths(payment).filter((month) => !taken.has(month));
    for (const month of months) taken.add(month);
    claimed.set(payment.key, taken);
    return months.length ? [{ ...payment, months }] : [];
  });
}

// What resolved payments expect in targetMonth (YYYY-MM): each payment made in the twelve months before it
// whose months include its calendar month.
function recurringMonthSpend(resolved, targetMonth) {
  const target = monthIndex(targetMonth);
  const calendarMonth = Number(targetMonth.slice(5, 7));
  return resolved.reduce((sum, payment) => {
    const age = target - monthIndex(payment.transactionDate.slice(0, 7));
    return age >= 1 && age <= MONTHS_PER_YEAR && payment.months.includes(calendarMonth) ? sum + payment.amountCentavos : sum;
  }, 0);
}

module.exports = { normalizeRecurrenceMonths, resolveRecurringPayments, recurringMonthSpend };
