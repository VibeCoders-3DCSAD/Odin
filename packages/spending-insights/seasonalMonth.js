// Mirrors odin-ml's full-year forecast for one category (forecast_service._seasonal_forecast) without the
// HFCE growth, so the Financial Plan follows the same seasons in the subcategories it budgets.
const FULL_YEAR_MONTHS = 12;
// A month above Q3 + 1.5 * IQR of the year's totals holds seasonal spending, such as tuition.
const SPIKE_IQR_FACTOR = 1.5;
// A month counts as spending above this share of the median spending month.
const ACTIVE_MONTH_SHARE = 0.1;
// Spending that turns on and off with the calendar does so in at most this many stretches a year, each on
// and off stretch lasting at least the minimum, so a single skipped month stays noise.
const MAX_SEASONS = 2;
const MIN_SEASON_MONTHS = 2;

function addMonths(month, count) {
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + count, 1)).toISOString().slice(0, 7);
}

// numpy's default linear interpolation.
function percentile(values, share) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = share * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

// Completed months from the first expense month in the last year through last month (YYYY-MM).
function historyWindow(expenseMonths, currentMonth) {
  const firstMonth = addMonths(currentMonth, -FULL_YEAR_MONTHS);
  let earliest = null;
  for (const month of expenseMonths) if (month >= firstMonth && month < currentMonth && (earliest === null || month < earliest)) earliest = month;
  const window = [];
  for (let month = earliest; month !== null && month < currentMonth; month = addMonths(month, 1)) window.push(month);
  return window;
}

function isFullYear(window) {
  return window.length >= FULL_YEAR_MONTHS;
}

function onMonths(values) {
  const positive = values.filter((value) => value > 0);
  if (positive.length === 0) return { pattern: null, seasons: [] };
  const threshold = ACTIVE_MONTH_SHARE * percentile(positive, 0.5);
  const active = values.map((value) => value > threshold);
  if (active.every(Boolean)) return { pattern: null, seasons: [] };
  const count = active.length;
  // Walk the year from the first off month after an on month, so no stretch splits at the wrap.
  const start = active.findIndex((on, index) => !on && active[(index - 1 + count) % count]);
  const stretches = [];
  for (let offset = 0; offset < count; offset += 1) {
    const index = (start + offset) % count;
    const last = stretches[stretches.length - 1];
    if (last && last.on === active[index]) last.indices.push(index);
    else stretches.push({ on: active[index], indices: [index] });
  }
  const seasons = stretches.filter((stretch) => stretch.on).map((stretch) => stretch.indices);
  if (seasons.length > MAX_SEASONS || stretches.some((stretch) => stretch.indices.length < MIN_SEASON_MONTHS)) return { pattern: null, seasons: [] };
  if (seasons.length === 1 && seasons[0].includes(count - 1) && !seasons[0].includes(0)) return { pattern: "new_expense", seasons };
  return { pattern: "seasonal", seasons };
}

// The spending a full year of history expects in targetMonth, before HFCE growth. monthly leaves out payments
// the user marked yearly; yearly holds those, which come back only in the month they recur.
function seasonalMonthSpend({ window, monthly, yearly, targetMonth }) {
  const values = window.map((month) => monthly.get(month) ?? 0);
  if (values.length === 0) return 0;
  const { pattern, seasons } = onMonths(values);
  const priorMonth = addMonths(targetMonth, -FULL_YEAR_MONTHS);
  const priorIndex = window.indexOf(priorMonth);
  const yearlyAmount = priorIndex >= 0 ? yearly.get(priorMonth) ?? 0 : 0;
  if (pattern === "new_expense") return values[values.length - 1] + yearlyAmount;
  if (pattern === "seasonal") {
    // Last year's months it was on, at the typical month of its latest on stretch.
    const latest = seasons.reduce((left, right) => Math.max(...right) > Math.max(...left) ? right : left);
    const onCalendarMonths = new Set(seasons.flat().map((index) => window[index].slice(5, 7)));
    const start = onCalendarMonths.has(targetMonth.slice(5, 7)) ? percentile(latest.map((index) => values[index]), 0.5) : 0;
    return start + yearlyAmount;
  }
  const q1 = percentile(values, 0.25);
  const q3 = percentile(values, 0.75);
  const spikes = values.map((value) => value > q3 + SPIKE_IQR_FACTOR * (q3 - q1));
  const typical = values.filter((_, index) => !spikes[index]);
  const base = typical.length ? typical.reduce((sum, value) => sum + value, 0) / typical.length : 0;
  const last = values[values.length - 1];
  const start = !spikes[spikes.length - 1] && last > 0 ? last : base;
  // Last year's spike in the same month comes back above the typical month.
  const excess = priorIndex >= 0 && spikes[priorIndex] ? values[priorIndex] - base : 0;
  return start + excess + yearlyAmount;
}

module.exports = { FULL_YEAR_MONTHS, historyWindow, isFullYear, seasonalMonthSpend };
